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

// Middleware de autenticación para admin
const authenticateAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'] || req.body.password;
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
};

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
let eventState = "waiting"; // waiting, trivia-active, trivia-results, voting-active, voting-results, countdown, revealed, trivia-winner, drawing-active, drawing-voting, drawing-results
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Revelaci0n#"; // Contraseña del administrador
let triviaScores = new Map(); // guestId -> total score
let currentTriviaIndex = 0;
let triviaResults = [];
let triviaWinner = null; // Datos del ganador de trivia

// Variables para el minijuego de dibujo
let drawingPrompts = []; // Prompts/temas para dibujar que agrega el admin
let currentDrawingPrompt = null;
let drawingSubmissions = new Map(); // guestId -> {drawing: dataURL, submittedAt: timestamp}
let drawingVotes = new Map(); // guestId -> votedDrawingId
let guestVotedDrawings = new Map(); // guestId -> Set of votedDrawingIds (para votos múltiples)
let drawingCountdown = null;
let drawingCountdownInterval = null;
let drawingScores = new Map(); // guestId -> puntos del minijuego de dibujo

// Función para enviar actualizaciones de votos de dibujo
function broadcastDrawingVotes() {
  if (eventState === 'drawing-voting') {
    console.log('Broadcasting drawing votes update...');
    const drawings = Array.from(drawingSubmissions.entries()).map(([guestId, submission]) => {
      const guest = Array.from(guests.values()).find(g => g.id === guestId);
      
      // Contar votos para este dibujo
      let votes = 0;
      for (const votedSet of guestVotedDrawings.values()) {
        if (votedSet.has(guestId)) {
          votes++;
        }
      }
      
      console.log(`Dibujo ${guestId} (${guest?.name}): ${votes} votos`);
      
      return {
        id: guestId,
        guestName: guest?.name || 'Anónimo',
        drawing: submission.drawing,
        votes
      };
    });
    
    console.log('Enviando actualización de votos a todos los clientes');
    io.emit('drawing-votes-update', { drawings });
  } else {
    console.log('No broadcasting votes - estado actual:', eventState);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
      // Simular error 500 al finalizar la cuenta regresiva
      socket.on('countdown-finished', () => {
        // Emitir un error 500 a todos los clientes
        io.emit('server-error', { code: 500, message: 'Error interno del servidor (simulado)' });
        console.error('Simulación de error 500 al finalizar la cuenta regresiva');
      });
    // Eliminar invitado inmediatamente al recibir 'remove-guest'
    socket.on('remove-guest', (data) => {
      const { guestId } = data;
      if (guestId && guests.has(guestId)) {
        const guest = guests.get(guestId);
        guests.delete(guestId);
        triviaScores.delete(guestId);
        drawingScores.delete(guestId);
        // Eliminar votos y respuestas asociadas
        triviaResponses.delete(guestId);
        finalVotes.delete(guestId);
        drawingSubmissions.delete(guestId);
        drawingVotes.delete(guestId);
        guestVotedDrawings.delete(guestId);
        io.emit('guest-update', Array.from(guests.values()));
        console.log(`Invitado eliminado inmediatamente: ${guest.name}`);
      }
    });
  console.log('Usuario conectado:', socket.id);

  // Registro de invitado
  socket.on('register-guest', (data) => {
    let guestId = data.guestId; // Puede venir de localStorage
    let guest;
    let isReconnection = false;
    
    // Si es una reconexión con ID existente
    if (guestId && guests.has(guestId)) {
      guest = guests.get(guestId);
      guest.socketId = socket.id; // Actualizar socket ID
      guest.isOnline = true;
      guest.reconnectedAt = new Date().toISOString();
      isReconnection = true;
      
      console.log(`Invitado reconectado: ${guest.name} (${guestId})`);
    } else {
      // Nuevo registro
      guestId = guestId || uuidv4(); // Usar ID existente o crear nuevo
      guest = {
        id: guestId,
        name: data.name,
        socketId: socket.id,
        isOnline: true,
        joinedAt: new Date().toISOString()
      };
      
      guests.set(guestId, guest);
      console.log(`Invitado registrado: ${data.name} (${guestId})`);
    }
    
    // Calcular puntuación total incluyendo puntos de género si aplica
    const triviaPoints = triviaScores.get(guestId) || 0;
    const drawingPoints = drawingScores.get(guestId) || 0;
    const genderPoints = (babyGender && eventState === 'revealed' && finalVotes.has(guestId) && finalVotes.get(guestId).vote === babyGender) ? 5 : 0;
    const totalScore = triviaPoints + drawingPoints + genderPoints;
    
    socket.emit('registration-success', { 
      guestId, 
      name: guest.name, 
      isReconnection,
      totalScore: totalScore
    });
    io.emit('guest-update', Array.from(guests.values()));
  });

  // Chat en vivo con censura automática
  socket.on('send-message', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    console.log('Mensaje recibido de:', guest ? guest.name : 'Usuario no registrado', 'Mensaje:', data.message);
    if (guest) {
      let message = data.message;
      let censurado = false;
      
      // Censurar respuestas si hay trivia activa
      if (currentTrivia && eventState === 'trivia-active') {
        const respuestaCorrecta = currentTrivia.correctAnswer.toLowerCase();
        
        // Mapeo de números a palabras y viceversa
        const numeroAPalabra = {
          '0': ['cero', 'zero'],
          '1': ['uno', 'un', 'una'],
          '2': ['dos'],
          '3': ['tres'],
          '4': ['cuatro'],
          '5': ['cinco'],
          '6': ['seis'],
          '7': ['siete'],
          '8': ['ocho'],
          '9': ['nueve'],
          '10': ['diez'],
          '11': ['once'],
          '12': ['doce'],
          '13': ['trece'],
          '14': ['catorce'],
          '15': ['quince'],
          '16': ['dieciséis', 'dieciseis'],
          '17': ['diecisiete'],
          '18': ['dieciocho'],
          '19': ['diecinueve'],
          '20': ['veinte']
        };
        
        // Función para censurar palabra completa o parcial
        const censurarRespuesta = (texto, respuesta) => {
          // Crear regex que busque la respuesta como palabra completa o parte de palabra
          const regex = new RegExp(`\\b${respuesta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|${respuesta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
          return texto.replace(regex, (match) => {
            censurado = true;
            return '*'.repeat(match.length);
          });
        };
        
        // Censurar respuesta exacta
        message = censurarRespuesta(message, respuestaCorrecta);
        
        // Si la respuesta es numérica, también censurar representaciones en palabras
        if (currentTrivia.type === 'number' && !isNaN(respuestaCorrecta)) {
          // Censurar el número como dígito
          const numeroRegex = new RegExp(`\\b${respuestaCorrecta}\\b`, 'g');
          message = message.replace(numeroRegex, (match) => {
            censurado = true;
            return '*'.repeat(match.length);
          });
          
          // Censurar representaciones en palabras del número
          if (numeroAPalabra[respuestaCorrecta]) {
            numeroAPalabra[respuestaCorrecta].forEach(palabra => {
              message = censurarRespuesta(message, palabra);
            });
          }
        }
        
        // Si la respuesta es una palabra que representa un número, censurar también el dígito
        if (currentTrivia.type === 'text') {
          Object.keys(numeroAPalabra).forEach(numero => {
            numeroAPalabra[numero].forEach(palabra => {
              if (palabra === respuestaCorrecta) {
                // Censurar también el número correspondiente
                const numeroRegex = new RegExp(`\\b${numero}\\b`, 'g');
                message = message.replace(numeroRegex, (match) => {
                  censurado = true;
                  return '*'.repeat(match.length);
                });
              }
            });
          });
        }
      }
      
      io.emit('new-message', {
        id: uuidv4(),
        name: guest.name,
        message: message,
        timestamp: new Date().toLocaleTimeString(),
        censurado: censurado
      });
      
      // Si se censuró, enviar advertencia privada al usuario
      if (censurado) {
        socket.emit('message-censored', {
          mensaje: '⚠️ Tu mensaje fue censurado porque contiene la respuesta de la trivia activa.'
        });
      }
    }
  });

  // Envío de emojis
  socket.on('send-emoji', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    console.log('Emoji recibido de:', guest ? guest.name : 'Usuario no registrado', 'Emoji:', data.emoji);
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
      let answer = data.answer;
      
      // Validar y limpiar respuesta según el tipo
      if (currentTrivia.type === 'number') {
        // Para respuestas numéricas, remover caracteres no numéricos
        answer = answer.toString().replace(/[^0-9]/g, '');
        if (answer === '') {
          // Si no queda nada después de limpiar, enviar error
          socket.emit('trivia-error', {
            message: '❌ Error: Solo se permiten números como respuesta.'
          });
          return;
        }
      }
      
      triviaResponses.set(guest.id, {
        guestId: guest.id,
        guestName: guest.name,
        answer: answer,
        timestamp: Date.now()
      });
      
      // Solo confirmar que se recibió la respuesta (sin revelar si es correcta)
      socket.emit('trivia-response-confirmed', {
        message: '✅ Respuesta enviada correctamente'
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
        questionId: question.id,
        options: question.options || null
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
      const individualResults = new Map();
      
      triviaResponses.forEach(response => {
        let isCorrect;
        if (currentTrivia.type === 'number') {
          isCorrect = parseInt(response.answer) === parseInt(currentTrivia.correctAnswer);
        } else if (currentTrivia.type === 'multiple-choice') {
          isCorrect = response.answer === currentTrivia.correctAnswer;
        } else {
          isCorrect = response.answer.toLowerCase() === currentTrivia.correctAnswer.toLowerCase();
        }
        const points = isCorrect ? currentTrivia.points : 0;
        
        // Actualizar puntajes totales
        const currentScore = triviaScores.get(response.guestId) || 0;
        triviaScores.set(response.guestId, currentScore + points);
        
        // Guardar resultado individual para enviar a cada usuario (incluye puntos de dibujo)
        const totalScoreWithDrawing = triviaScores.get(response.guestId) + (drawingScores.get(response.guestId) || 0);
        individualResults.set(response.guestId, {
          isCorrect,
          points,
          totalScore: totalScoreWithDrawing
        });
        
        results.push({
          guestId: response.guestId,
          guestName: response.guestName,
          answer: response.answer,
          isCorrect,
          points,
          totalScore: triviaScores.get(response.guestId) + (drawingScores.get(response.guestId) || 0)
        });
      });
      
      // Enviar resultados individuales a cada usuario
      Array.from(guests.values()).forEach(guest => {
        const guestResult = individualResults.get(guest.id);
        if (guestResult) {
          // Encontrar el socket del usuario y enviar su resultado personal
          const guestSocket = io.sockets.sockets.get(guest.socketId);
          if (guestSocket) {
            guestSocket.emit('trivia-personal-result', {
              isCorrect: guestResult.isCorrect,
              correctAnswer: currentTrivia.correctAnswer,
              points: guestResult.points,
              totalScore: (triviaScores.get(guest.id) || 0) + (drawingScores.get(guest.id) || 0)
            });
          }
        } else {
          // Usuario que no respondió
          const guestSocket = io.sockets.sockets.get(guest.socketId);
          if (guestSocket) {
            guestSocket.emit('trivia-personal-result', {
              isCorrect: false,
              correctAnswer: currentTrivia.correctAnswer,
              points: 0,
              totalScore: (triviaScores.get(guest.id) || 0) + (drawingScores.get(guest.id) || 0)
            });
          }
        }
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
    
    // Calcular ranking final (incluye puntos de trivia + dibujo)
    const finalScores = [];
    const allGuestIds = new Set([...triviaScores.keys(), ...drawingScores.keys()]);
    
    allGuestIds.forEach((guestId) => {
      const guest = Array.from(guests.values()).find(g => g.id === guestId);
      if (guest) {
        const triviaPoints = triviaScores.get(guestId) || 0;
        const drawingPoints = drawingScores.get(guestId) || 0;
        finalScores.push({
          guestName: guest.name,
          totalScore: triviaPoints + drawingPoints
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
    
    // Si el género ya fue revelado, otorgar puntos por votos correctos
    if (babyGender) {
      finalVotes.forEach((voteData, guestId) => {
        if (voteData.vote === babyGender) {
          // Otorgar 5 puntos por adivinar correctamente
          const guest = Array.from(guests.values()).find(g => g.id === guestId);
          if (guest) {
            const currentTriviaPoints = triviaScores.get(guestId) || 0;
            const currentDrawingPoints = drawingScores.get(guestId) || 0;
            const newTotalScore = currentTriviaPoints + currentDrawingPoints + 5;
            
            console.log(`🎯 ${guest.name} recibe 5 puntos por adivinar el género correctamente! Total: ${newTotalScore} puntos`);
            
            // Notificar al ganador sobre sus puntos
            io.to(guest.socketId).emit('gender-points-awarded', {
              points: 5,
              totalScore: newTotalScore,
              message: '🏆 ¡Has ganado 5 puntos por adivinar correctamente!'
            });
          }
        }
      });
    }
    
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
    
    // Agregar puntos de dibujo
    drawingScores.forEach((drawingScore, guestId) => {
      const currentScore = finalScores.get(guestId) || 0;
      finalScores.set(guestId, currentScore + drawingScore);
    });
    
    // Agregar puntos por adivinar el sexo (solo si ya se reveló)
    if (babyGender && eventState === 'revealed') {
      finalVotes.forEach((voteData, guestId) => {
        const currentScore = finalScores.get(guestId) || 0;
        // +20 puntos por adivinar correctamente el sexo
        if (voteData.vote === babyGender) {
          finalScores.set(guestId, currentScore + 20);
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
          const genderPoints = (babyGender && finalVotes.has(guestId) && finalVotes.get(guestId).vote === babyGender) ? 20 : 0;
          const drawingPoints = drawingScores.get(guestId) || 0;
          
          winner = {
            guestId,
            guestName: guest.name,
            totalScore: totalScore,
            triviaPoints,
            genderPoints,
            drawingPoints
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
          const drawingPoints = drawingScores.get(guestId) || 0;
          const genderPoints = (babyGender && finalVotes.has(guestId) && finalVotes.get(guestId).vote === babyGender) ? 5 : 0;
          
          return {
            guestId,
            guestName: guest ? guest.name : 'Desconocido',
            totalScore: totalScore,
            triviaPoints,
            drawingPoints,
            genderPoints
          };
        }).sort((a, b) => b.totalScore - a.totalScore)
      });
      
      console.log(`Ganador final revelado: ${winner.guestName} con ${winner.totalScore} puntos (Trivia: ${winner.triviaPoints}, Sexo: ${winner.genderPoints}, Dibujo: ${winner.drawingPoints})`);
    } else {
      console.log('No hay ganador de trivia (ningún puntaje registrado)');
    }
  });

  // Iniciar minijuego de dibujo
  socket.on('admin-start-drawing-game', (data) => {
    const { promptId, duration } = data;
    const prompt = drawingPrompts.find(p => p.id === promptId);
    
    if (prompt) {
      currentDrawingPrompt = prompt;
      drawingSubmissions.clear();
      drawingVotes.clear();
      eventState = 'drawing-active';
      drawingCountdown = duration || 120; // 2 minutos por defecto
      
      io.emit('drawing-game-started', {
        prompt: prompt.prompt,
        duration: drawingCountdown
      });
      
      // Cuenta regresiva
      drawingCountdownInterval = setInterval(() => {
        drawingCountdown--;
        io.emit('drawing-countdown-update', drawingCountdown);
        
        if (drawingCountdown <= 0) {
          clearInterval(drawingCountdownInterval);
          drawingCountdownInterval = null;
          // Pasar a fase de votación
          eventState = 'drawing-voting';
          const drawings = Array.from(drawingSubmissions.values()).map((submission, index) => ({
            id: submission.guestId,
            drawing: submission.drawing,
            guestName: Array.from(guests.values()).find(g => g.id === submission.guestId)?.name || 'Anónimo'
          }));
          
          io.emit('drawing-voting-started', { 
            drawings,
            prompt: currentDrawingPrompt?.prompt || 'Dibujo libre'
          });
        }
      }, 1000);
      
      console.log(`Minijuego de dibujo iniciado: ${prompt.prompt}`);
    }
  });
  
  // Recibir dibujo de invitado
  socket.on('submit-drawing', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest && eventState === 'drawing-active') {
      drawingSubmissions.set(guest.id, {
        guestId: guest.id,
        drawing: data.drawing,
        submittedAt: Date.now()
      });
      
      socket.emit('drawing-submitted', {
        message: '🎨 Dibujo enviado correctamente'
      });
      
      console.log(`Dibujo recibido de: ${guest.name}`);
      
      // Verificar si todos los invitados han terminado de dibujar
      const connectedGuests = Array.from(guests.values()).length;
      const submittedDrawings = drawingSubmissions.size;
      
      console.log(`Dibujos enviados: ${submittedDrawings}/${connectedGuests}`);
      
      // Si todos los invitados han enviado su dibujo, iniciar votación automáticamente
      if (submittedDrawings === connectedGuests && connectedGuests > 0) {
        console.log('Todos los invitados han terminado de dibujar. Iniciando votación automáticamente...');
        
        // Limpiar el countdown interval si está corriendo
        if (drawingCountdownInterval) {
          clearInterval(drawingCountdownInterval);
          drawingCountdownInterval = null;
          console.log('Countdown interval limpiado');
        }
        
        // Cambiar estado a votación
        eventState = 'drawing-voting';
        
        const drawings = Array.from(drawingSubmissions.values()).map((submission) => ({
          id: submission.guestId,
          drawing: submission.drawing,
          guestName: Array.from(guests.values()).find(g => g.id === submission.guestId)?.name || 'Anónimo'
        }));
        
        io.emit('drawing-voting-started', { 
          drawings,
          prompt: currentDrawingPrompt?.prompt || 'Dibujo libre'
        });
      }
    }
  });
  
  // Votar por dibujo
  socket.on('vote-drawing', (data) => {
    const guest = Array.from(guests.values()).find(g => g.socketId === socket.id);
    if (guest && eventState === 'drawing-voting') {
      // Permitir votos múltiples
      if (!guestVotedDrawings.has(guest.id)) {
        guestVotedDrawings.set(guest.id, new Set());
      }
      
      const votedSet = guestVotedDrawings.get(guest.id);
      
      // Toggle del voto (si ya votó por este dibujo, remover el voto)
      if (votedSet.has(data.drawingId)) {
        votedSet.delete(data.drawingId);
        socket.emit('drawing-vote-confirmed', {
          message: '❌ Voto removido',
          drawingId: data.drawingId,
          voted: false
        });
      } else {
        votedSet.add(data.drawingId);
        socket.emit('drawing-vote-confirmed', {
          message: '✓ Voto registrado',
          drawingId: data.drawingId,
          voted: true
        });
      }
      
      console.log(`Voto de dibujo de: ${guest.name} -> Dibujo ${data.drawingId} (${votedSet.has(data.drawingId) ? 'agregado' : 'removido'})`);
      
      // Enviar actualización de votos en tiempo real
      broadcastDrawingVotes();
    }
  });
  
  // Mostrar resultados de dibujos
  socket.on('admin-show-drawing-results', () => {
    if (eventState === 'drawing-voting') {
      const submissions = Array.from(drawingSubmissions.entries()).map(([guestId, submission]) => {
        const guest = Array.from(guests.values()).find(g => g.id === guestId);
        // Contar votos de todos los invitados que votaron por este dibujo
        let votes = 0;
        for (const votedSet of guestVotedDrawings.values()) {
          if (votedSet.has(guestId)) {
            votes++;
          }
        }
        return {
          guestId,
          guestName: guest?.name || 'Anónimo',
          drawing: submission.drawing,
          votes
        };
      });

      // Ordenar por votos (descendente) para crear ranking
      const rankings = submissions.sort((a, b) => b.votes - a.votes);

      // Asignar puntos a los 3 primeros lugares (incluyendo empates)
      const pointsByPlace = [5, 3, 1];
      let currentPlace = 0;
      let lastVotes = null;
      let assigned = 0;
      const winners = [];
      for (let i = 0; i < rankings.length && currentPlace < 3; i++) {
        const r = rankings[i];
        if (lastVotes === null || r.votes < lastVotes) {
          currentPlace = assigned;
        }
        if (currentPlace < 3 && r.votes > 0) {
          const points = pointsByPlace[currentPlace];
          const currentDrawingPoints = drawingScores.get(r.guestId) || 0;
          drawingScores.set(r.guestId, currentDrawingPoints + points);
          // Notificar a cada ganador
          const winnerGuest = Array.from(guests.values()).find(g => g.id === r.guestId);
          if (winnerGuest) {
            const currentTriviaPoints = triviaScores.get(r.guestId) || 0;
            const newTotalScore = currentTriviaPoints + (drawingScores.get(r.guestId) || 0);
            io.to(winnerGuest.socketId).emit('drawing-points-awarded', {
              points,
              totalScore: newTotalScore,
              message: `🏆 ¡Has ganado ${points} punto${points > 1 ? 's' : ''} por tu dibujo!`
            });
          }
          winners.push(r);
        }
        assigned++;
        lastVotes = r.votes;
      }

      eventState = 'drawing-results';
      io.emit('drawing-results', {
        rankings,
        winners,
        maxVotes: rankings.length > 0 ? rankings[0].votes : 0,
        prompt: currentDrawingPrompt?.prompt || 'Dibujo libre',
        totalParticipants: Array.from(guests.values()).length,
        totalVotes: Array.from(guestVotedDrawings.values()).reduce((acc, votedSet) => acc + votedSet.size, 0),
        pointsAwarded: winners.length > 0 ? pointsByPlace.slice(0, winners.length) : []
      });
      console.log(`Resultados de dibujo mostrados. Ganadores: ${winners.map(w => w.guestName).join(', ') || 'Ninguno'}`);
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
    drawingSubmissions.clear();
    drawingVotes.clear();
    guestVotedDrawings.clear();
    drawingScores.clear();
    currentDrawingPrompt = null;
    drawingCountdown = null;
    
    // Limpiar countdown interval si está corriendo
    if (drawingCountdownInterval) {
      clearInterval(drawingCountdownInterval);
      drawingCountdownInterval = null;
    }
    
    io.emit('event-reset');
    console.log('Evento reiniciado');
  });

  // Desconexión
  socket.on('disconnect', () => {
    // Marcar invitado como desconectado pero no eliminarlo inmediatamente
    for (let [id, guest] of guests.entries()) {
      if (guest.socketId === socket.id) {
        guest.isOnline = false;
        guest.lastSeen = new Date().toISOString();
        
        // Eliminar después de 30 minutos de inactividad
        setTimeout(() => {
          if (guests.has(id) && !guests.get(id).isOnline) {
            guests.delete(id);
            // También limpiar puntajes de trivia para este usuario
            triviaScores.delete(id);
            io.emit('guest-update', Array.from(guests.values()));
            console.log(`Invitado eliminado por inactividad: ${guest.name}`);
          }
        }, 30 * 60 * 1000); // 30 minutos
        
        io.emit('guest-update', Array.from(guests.values()));
        console.log(`Invitado desconectado: ${guest.name}`);
        break;
      }
    }
    console.log('Usuario desconectado:', socket.id);
  });
});

// API Routes
app.get('/api/trivia', authenticateAdmin, (req, res) => {
  res.json(triviaQuestions);
});

app.post('/api/trivia', authenticateAdmin, (req, res) => {
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

app.get('/api/gender', authenticateAdmin, (req, res) => {
  res.json({ gender: babyGender });
});

app.post('/api/gender', authenticateAdmin, (req, res) => {
  babyGender = req.body.gender;
  res.json({ gender: babyGender });
});

// Endpoints para prompts de dibujo
app.get('/api/drawing-prompts', authenticateAdmin, (req, res) => {
  res.json(drawingPrompts);
});

app.post('/api/drawing-prompts', authenticateAdmin, (req, res) => {
  const { prompt } = req.body;
  const newPrompt = {
    id: Date.now(),
    prompt: prompt,
    createdAt: new Date().toISOString()
  };
  drawingPrompts.push(newPrompt);
  res.json(newPrompt);
});

app.delete('/api/drawing-prompts/:id', authenticateAdmin, (req, res) => {
  const promptId = parseInt(req.params.id);
  drawingPrompts = drawingPrompts.filter(p => p.id !== promptId);
  res.json({ success: true });
});

// Endpoint de login para admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: 'Acceso concedido' });
  } else {
    res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
  }
});

app.get('/api/guests', authenticateAdmin, (req, res) => {
  res.json(Array.from(guests.values()));
});

app.get('/api/status', authenticateAdmin, (req, res) => {
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

// Serve React app (solo en producción)
app.get('*', (req, res) => {
  const buildPath = path.join(__dirname, 'client/build', 'index.html');
  
  // Verificar si existe el archivo build
  if (fs.existsSync(buildPath)) {
    res.sendFile(buildPath);
  } else {
    // En desarrollo, mostrar mensaje informativo
    res.send(`
      <html>
        <body style="font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
          <h1>🎉 Baby Reveal App - Servidor en Desarrollo</h1>
          <p>El servidor está corriendo en modo desarrollo.</p>
          <h3>URLs disponibles:</h3>
          <div style="margin: 20px 0;">
            <a href="/admin" style="color: #FFD700; text-decoration: none; font-size: 18px; display: block; margin: 10px 0;">
              🎛️ Panel de Administración
            </a>
          </div>
          <p style="margin-top: 40px; opacity: 0.8; font-size: 14px;">
            Para la interfaz completa, compila el cliente con: <code>npm run build:client</code>
          </p>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Guest interface: http://localhost:${PORT}`);
});