const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// Archivo para persistir las preguntas de trivia
const TRIVIA_FILE = path.join(__dirname, 'trivia-questions.json');

// Función para cargar preguntas desde archivo
function loadTriviaQuestions() {
  try {
    if (fs.existsSync(TRIVIA_FILE)) {
      const data = fs.readFileSync(TRIVIA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error cargando preguntas de trivia:', error);
  }
  
  // Preguntas por defecto si no existe el archivo
  return [
    {
      id: 1,
      question: "¿Cuántos meses dura el embarazo?",
      correctAnswer: "9",
      points: 10,
      type: "number"
    },
    {
      id: 2,
      question: "¿Cuál es el primer sentido que desarrolla un bebé?",
      correctAnswer: "tacto",
      points: 15,
      type: "text"
    }
  ];
}

// Función para guardar preguntas en archivo
function saveTriviaQuestions() {
  try {
    fs.writeFileSync(TRIVIA_FILE, JSON.stringify(triviaQuestions, null, 2));
    console.log('Preguntas de trivia guardadas exitosamente');
  } catch (error) {
    console.error('Error guardando preguntas de trivia:', error);
  }
}

// Data storage (en producción usar base de datos)
let guests = new Map(); // id -> {name, socketId}
let triviaQuestions = loadTriviaQuestions(); // Cargar preguntas desde archivo
let currentTrivia = null;
let triviaResponses = new Map(); // guestId -> response
let finalVotes = new Map(); // guestId -> "boy" | "girl"
let babyGender = null; // "boy" | "girl"
let eventState = "waiting"; // waiting, trivia-active, trivia-results, voting-active, voting-results, countdown, revealed, trivia-winner
let triviaScores = new Map(); // guestId -> total score
let currentTriviaIndex = 0;
let triviaResults = [];
let triviaWinner = null; // Datos del ganador de trivia

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Registro de invitado
  socket.on('register-guest', (data) => {
    const guestId = uuidv4();
    const guest = {
      id: guestId,
      name: data.name,
      socketId: socket.id
    };
    guests.set(guestId, guest);
    
    socket.emit('registration-success', { guestId, name: data.name });
    io.emit('guest-update', Array.from(guests.values()));
    
    console.log(`Invitado registrado: ${data.name} (${guestId})`);
  });

  // Chat en vivo
  socket.on('send-message', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest) {
      io.emit('new-message', {
        id: uuidv4(),
        name: guest.name,
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });

  // Envío de emojis
  socket.on('send-emoji', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest) {
      io.emit('new-emoji', {
        emoji: data.emoji,
        name: guest.name,
        x: Math.random() * 100,
        y: Math.random() * 100
      });
    }
  });

  // Respuesta a trivia
  socket.on('trivia-response', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest && currentTrivia && eventState === 'trivia-active') {
      triviaResponses.set(guest.id, {
        guestId: guest.id,
        guestName: guest.name,
        answer: data.answer,
        timestamp: Date.now()
      });
      
      // Verificar si la respuesta es correcta para notificar al invitado
      const isCorrect = data.answer.toLowerCase() === currentTrivia.correctAnswer.toLowerCase();
      
      // Enviar resultado individual al invitado
      socket.emit('trivia-personal-result', {
        isCorrect,
        correctAnswer: currentTrivia.correctAnswer,
        points: isCorrect ? currentTrivia.points : 0
      });
      
      // Notificar al admin sobre nueva respuesta
      io.emit('trivia-response-received', {
        guestName: guest.name,
        totalResponses: triviaResponses.size,
        totalGuests: guests.size
      });
    }
  });

  // Voto final (permitir cambios múltiples)
  socket.on('final-vote', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest && eventState === 'voting-active') {
      // Actualizar voto (permitir cambiar voto)
      finalVotes.set(guest.id, {
        guestId: guest.id,
        guestName: guest.name,
        vote: data.vote // "boy" | "girl"
      });
      
      // Emitir votos actualizados en tiempo real
      const voteCounts = {
        boy: { count: 0, names: [] },
        girl: { count: 0, names: [] }
      };
      
      finalVotes.forEach(vote => {
        voteCounts[vote.vote].count++;
        voteCounts[vote.vote].names.push(vote.guestName);
      });
      
      // Confirmar al invitado que su voto fue registrado
      socket.emit('vote-confirmed', { 
        vote: data.vote,
        canChange: true 
      });
      
      io.emit('votes-update', voteCounts);
    }
  });

  // Admin events - Flujo estructurado
  // 1. Iniciar Trivia (pregunta individual)
  socket.on('admin-start-trivia-question', (triviaId) => {
    console.log('Recibido evento admin-start-trivia-question con ID:', triviaId);
    const question = triviaQuestions.find(q => q.id === triviaId);
    console.log('Pregunta encontrada:', question);
    if (question) {
      currentTrivia = question;
      triviaResponses.clear();
      eventState = 'trivia-active';
      
      io.emit('trivia-question-started', {
        question: question.question,
        type: question.type,
        points: question.points,
        questionId: question.id
      });
      
      console.log(`Trivia iniciada: ${question.question}`);
    } else {
      console.log('ERROR: No se encontró la pregunta con ID:', triviaId);
    }
  });

  // Mostrar resultados de pregunta individual
  socket.on('admin-show-question-results', () => {
    if (currentTrivia && eventState === 'trivia-active') {
      // Calcular resultados de esta pregunta
      const results = [];
      triviaResponses.forEach(response => {
        const isCorrect = response.answer.toLowerCase() === currentTrivia.correctAnswer.toLowerCase();
        const points = isCorrect ? currentTrivia.points : 0;
        
        // Actualizar puntajes totales
        const currentScore = triviaScores.get(response.guestId) || 0;
        triviaScores.set(response.guestId, currentScore + points);
        
        results.push({
          guestId: response.guestId,
          guestName: response.guestName,
          answer: response.answer,
          isCorrect,
          points,
          totalScore: triviaScores.get(response.guestId)
        });
      });
      
      eventState = 'trivia-results';
      
      io.emit('trivia-question-results', {
        question: currentTrivia.question,
        correctAnswer: currentTrivia.correctAnswer,
        results,
        questionComplete: true
      });
      
      // Guardar resultado para el resumen final
      triviaResults.push({
        question: currentTrivia.question,
        correctAnswer: currentTrivia.correctAnswer,
        results
      });
      
      console.log(`Resultados mostrados para: ${currentTrivia.question}`);
      currentTrivia = null;
    }
  });

  // 2. Finalizar Trivia (mostrar resultados finales)
  socket.on('admin-end-trivia', () => {
    eventState = 'trivia-final';
    
    // Calcular ranking final
    const finalScores = [];
    triviaScores.forEach((score, guestId) => {
      const guest = Array.from(guests.values()).find(g => g.id === guestId);
      if (guest) {
        finalScores.push({
          guestName: guest.name,
          totalScore: score
        });
      }
    });
    
    // Ordenar por puntaje
    finalScores.sort((a, b) => b.totalScore - a.totalScore);
    
    io.emit('trivia-final-results', {
      finalScores,
      allResults: triviaResults
    });
    
    console.log('Trivia finalizada - Resultados finales mostrados');
  });

  // 3. Iniciar Votación (niño o niña)
  socket.on('admin-start-voting', () => {
    finalVotes.clear();
    eventState = 'voting-active';
    io.emit('voting-started');
    console.log('Votación iniciada');
  });

  // 4. Finalizar Votación (mostrar resultados)
  socket.on('admin-end-voting', () => {
    eventState = 'voting-results';
    
    const voteCounts = {
      boy: { count: 0, names: [] },
      girl: { count: 0, names: [] }
    };
    
    finalVotes.forEach(vote => {
      voteCounts[vote.vote].count++;
      voteCounts[vote.vote].names.push(vote.guestName);
    });
    
    const winner = voteCounts.boy.count > voteCounts.girl.count ? 'boy' : 
                   voteCounts.girl.count > voteCounts.boy.count ? 'girl' : 'tie';
    
    io.emit('voting-final-results', {
      results: voteCounts,
      winner,
      totalVotes: voteCounts.boy.count + voteCounts.girl.count
    });
    
    console.log(`Votación finalizada - Ganador: ${winner}`);
  });

  // 5. Empezar Cuenta Regresiva
  socket.on('admin-start-countdown', () => {
    eventState = 'countdown';
    io.emit('countdown-started');
    console.log('Cuenta regresiva iniciada');
  });

  // 6. Revelar Sexo
  socket.on('admin-reveal-gender', () => {
    eventState = 'revealed';
    io.emit('gender-revealed', { gender: babyGender });
    console.log(`Género revelado: ${babyGender}`);
  });

  // 7. Mostrar Ganador Final (Trivia + Adivinanza del Sexo)
  socket.on('admin-show-trivia-winner', () => {
    // Calcular el ganador final (trivia + adivinanza del sexo)
    let maxScore = -1;
    let winner = null;
    
    // Crear mapa de puntuaciones finales
    const finalScores = new Map();
    
    // Agregar puntos de trivia
    triviaScores.forEach((triviaScore, guestId) => {
      finalScores.set(guestId, triviaScore);
    });
    
    // Agregar puntos por adivinar el sexo (solo si ya se reveló)
    if (babyGender && eventState === 'revealed') {
      finalVotes.forEach((voteData, guestId) => {
        const currentScore = finalScores.get(guestId) || 0;
        // +5 puntos por adivinar correctamente el sexo
        if (voteData.vote === babyGender) {
          finalScores.set(guestId, currentScore + 5);
        } else {
          finalScores.set(guestId, currentScore);
        }
      });
    }
    
    // Encontrar el ganador con mayor puntuación total
    finalScores.forEach((totalScore, guestId) => {
      if (totalScore > maxScore) {
        maxScore = totalScore;
        const guest = Array.from(guests.values()).find(g => g.id === guestId);
        if (guest) {
          const triviaPoints = triviaScores.get(guestId) || 0;
          const genderPoints = (babyGender && finalVotes.has(guestId) && finalVotes.get(guestId).vote === babyGender) ? 5 : 0;
          
          winner = {
            guestId,
            guestName: guest.name,
            totalScore: totalScore,
            triviaPoints,
            genderPoints
          };
        }
      }
    });

    if (winner && winner.totalScore > 0) {
      triviaWinner = winner;
      eventState = 'trivia-winner';
      
      io.emit('trivia-winner-revealed', {
        winner: triviaWinner,
        allScores: Array.from(finalScores.entries()).map(([guestId, totalScore]) => {
          const guest = Array.from(guests.values()).find(g => g.id === guestId);
          const triviaPoints = triviaScores.get(guestId) || 0;
          const genderPoints = (babyGender && finalVotes.has(guestId) && finalVotes.get(guestId).vote === babyGender) ? 5 : 0;
          
          return {
            guestId,
            guestName: guest ? guest.name : 'Desconocido',
            totalScore: totalScore,
            triviaPoints,
            genderPoints
          };
        }).sort((a, b) => b.totalScore - a.totalScore)
      });
      
      console.log(`Ganador final revelado: ${winner.guestName} con ${winner.totalScore} puntos (Trivia: ${winner.triviaPoints}, Sexo: ${winner.genderPoints})`);
    } else {
      console.log('No hay ganador de trivia (ningún puntaje registrado)');
    }
  });

  // Reiniciar evento completo
  socket.on('admin-reset-event', () => {
    eventState = 'waiting';
    currentTrivia = null;
    triviaResponses.clear();
    finalVotes.clear();
    triviaScores.clear();
    triviaResults = [];
    triviaWinner = null;
    currentTriviaIndex = 0;
    
    io.emit('event-reset');
    console.log('Evento reiniciado');
  });

  // Desconexión
  socket.on('disconnect', () => {
    // Remover invitado si estaba registrado
    for (let [id, guest] of guests.entries()) {
      if (guest.socketId === socket.id) {
        guests.delete(id);
        io.emit('guest-update', Array.from(guests.values()));
        break;
      }
    }
    console.log('Usuario desconectado:', socket.id);
  });
});

// API Routes
app.get('/api/trivia', (req, res) => {
  res.json(triviaQuestions);
});

app.post('/api/trivia', (req, res) => {
  const { question, correctAnswer, points, type } = req.body;
  const newQuestion = {
    id: Date.now(),
    question,
    correctAnswer,
    points: parseInt(points),
    type
  };
  triviaQuestions.push(newQuestion);
  saveTriviaQuestions(); // Guardar en archivo
  res.json(newQuestion);
});

app.put('/api/trivia/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = triviaQuestions.findIndex(q => q.id === id);
  
  if (index !== -1) {
    triviaQuestions[index] = {
      ...triviaQuestions[index],
      ...req.body
    };
    saveTriviaQuestions(); // Guardar en archivo
    res.json(triviaQuestions[index]);
  } else {
    res.status(404).json({ error: 'Pregunta no encontrada' });
  }
});

app.delete('/api/trivia/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = triviaQuestions.findIndex(q => q.id === id);
  
  if (index !== -1) {
    triviaQuestions.splice(index, 1);
    saveTriviaQuestions(); // Guardar en archivo
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Pregunta no encontrada' });
  }
});

app.get('/api/gender', (req, res) => {
  res.json({ gender: babyGender });
});

app.post('/api/gender', (req, res) => {
  babyGender = req.body.gender;
  res.json({ gender: babyGender });
});

app.get('/api/guests', (req, res) => {
  res.json(Array.from(guests.values()));
});

app.get('/api/status', (req, res) => {
  // Calcular votos actuales
  const voteCounts = {
    boy: { count: 0, names: [] },
    girl: { count: 0, names: [] }
  };
  
  finalVotes.forEach(vote => {
    voteCounts[vote.vote].count++;
    voteCounts[vote.vote].names.push(vote.guestName);
  });

  res.json({
    eventState,
    guestCount: guests.size,
    currentTrivia: currentTrivia ? {
      question: currentTrivia.question,
      type: currentTrivia.type,
      points: currentTrivia.points
    } : null,
    triviaResponses: triviaResponses.size,
    votes: voteCounts,
    babyGender
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Guest interface: http://localhost:${PORT}`);
});