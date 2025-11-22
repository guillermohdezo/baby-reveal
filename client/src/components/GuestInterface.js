import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';


function GuestInterface() {

  // State and refs
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [triviaAnswer, setTriviaAnswer] = useState('');
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [drawingSubmitted, setDrawingSubmitted] = useState(false);
  const [drawingCountdown, setDrawingCountdown] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasRef] = useState(() => React.createRef());
  const [totalScore, setTotalScore] = useState(0);
  const [eventState, setEventState] = useState('waiting');
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [votingData, setVotingData] = useState({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
  const [currentVote, setCurrentVote] = useState(null);
  const [responseSubmitted, setResponseSubmitted] = useState(false);
  const [drawingPrompt, setDrawingPrompt] = useState(null);
  const [votingDrawings, setVotingDrawings] = useState([]);
  const [myVotes, setMyVotes] = useState(new Set());
  const [triviaPersonalResult, setTriviaPersonalResult] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [revealedGender, setRevealedGender] = useState(null);
  const [triviaWinnerData, setTriviaWinnerData] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [drawingResults, setDrawingResults] = useState(null);
  const [emojis] = useState(['🎉', '😂', '😍', '👏', '😮', '😎', '🥳', '😭', '🤩', '😱']);
  const messagesEndRef = useRef(null);
  // Listener para inicio de trivia
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setCurrentTrivia({
        question: data.question,
        type: data.type,
        points: data.points,
        id: data.questionId,
        options: data.options || null
      });
      setEventState('trivia-active');
      setTriviaPersonalResult(null);
      setResponseSubmitted(false);
      setTriviaAnswer('');
    };
    socket.on('trivia-question-started', handler);
    return () => {
      socket.off('trivia-question-started', handler);
    };
  }, [socket]);

  // Listener para puntos ganados en el minijuego de dibujo
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (typeof data.totalScore === 'number') {
        setTotalScore(data.totalScore);
      }
    };
    socket.on('drawing-points-awarded', handler);
    return () => {
      socket.off('drawing-points-awarded', handler);
    };
  }, [socket]);

  // Listener para resultado personal de trivia
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setTriviaPersonalResult({
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        points: data.points
      });
      if (typeof data.totalScore === 'number') {
        setTotalScore(data.totalScore);
      }
      setResponseSubmitted(false);
      setCurrentTrivia(null);
      setEventState('trivia-results');
    };
    socket.on('trivia-personal-result', handler);
    return () => {
      socket.off('trivia-personal-result', handler);
    };
  }, [socket]);

  // Listener para inicio de votación final (niño o niña)
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setEventState('voting-active');
      setCurrentVote(null);
      setHasVoted(false);
    };
    socket.on('voting-started', handler);
    return () => {
      socket.off('voting-started', handler);
    };
  }, [socket]);

  // Listener para confirmación de voto final
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setCurrentVote(data.vote);
      setHasVoted(true);
    };
    socket.on('vote-confirmed', handler);
    return () => {
      socket.off('vote-confirmed', handler);
    };
  }, [socket]);

  // Listener para actualización de votos en tiempo real
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setVotingData(data);
    };
    socket.on('votes-update', handler);
    return () => {
      socket.off('votes-update', handler);
    };
  }, [socket]);

  // Listener para revelación de género
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setRevealedGender(data.gender);
      setEventState('revealed');
    };
    socket.on('gender-revealed', handler);
    return () => {
      socket.off('gender-revealed', handler);
    };
  }, [socket]);

  // Listener para mostrar ganador final de trivia
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setTriviaWinnerData(data);
      setEventState('trivia-winner');
    };
    socket.on('trivia-winner-revealed', handler);
    return () => {
      socket.off('trivia-winner-revealed', handler);
    };
  }, [socket]);
  // Restaurar sesión de invitado si existe en localStorage
  // Restaurar sesión de invitado si existe en localStorage
  useEffect(() => {
    const savedGuestData = localStorage.getItem('guestData');
    if (savedGuestData) {
      try {
        const guestData = JSON.parse(savedGuestData);
        if (guestData.guestId && guestData.name) {
          setGuestId(guestData.guestId);
          setGuestName(guestData.name);
          setIsRegistered(true);
        }
      } catch (error) {
        // Si hay error, limpiar localStorage corrupto
        localStorage.removeItem('guestData');
      }
    }
  }, []);

  // Listener para resultados de votación de dibujos
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setEventState('drawing-results');
      setDrawingResults(data); // Guardar resultados para mostrar puntos
    };
    socket.on('drawing-results', handler);
    return () => {
      socket.off('drawing-results', handler);
    };
  }, [socket]);

  // Reenviar registro automáticamente si hay sesión restaurada y socket listo
  useEffect(() => {
    if (socket && guestId && guestName && isRegistered) {
      socket.emit('register-guest', {
        name: guestName,
        guestId: guestId
      });
    }
  }, [socket, guestId, guestName, isRegistered]);

  // Handler para enviar emojis
  const sendEmoji = (emoji) => {
    if (socket && isRegistered) {
      socket.emit('send-emoji', { emoji });
    }
  };

  // Handler para enviar mensajes en el chat
  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket && isRegistered) {
      socket.emit('send-message', { message: newMessage.trim() });
      setNewMessage('');
    }
  };

  // Handler para el registro de invitado
  const handleRegister = (e) => {
    e.preventDefault();
    if (guestName.trim() && socket) {
      const savedGuestData = localStorage.getItem('guestData');
      let guestId = null;
      if (savedGuestData) {
        try {
          const guestData = JSON.parse(savedGuestData);
          guestId = guestData.guestId;
        } catch (error) {
          console.error('Error parsing saved guest data:', error);
        }
      }
      socket.emit('register-guest', {
        name: guestName.trim(),
        guestId: guestId
      });
    }
  };



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize socket connection
  useEffect(() => {
    // Only connect if not already connected
    if (!socket) {
      // Use relative path to work with proxy or same origin
      const newSocket = io();
      setSocket(newSocket);

      // Clean up on unmount
      return () => {
        newSocket.disconnect();
      };
    }
  }, []);

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Escuchar el evento correcto del backend
    socket.on('registration-success', (data) => {
      setIsRegistered(true);
      setGuestId(data.guestId);
      setTotalScore(data.totalScore || 0);
      // Guardar datos del invitado en localStorage
      localStorage.setItem('guestData', JSON.stringify({ guestId: data.guestId, name: guestName }));
    });

    socket.on('registration-failed', (msg) => {
      alert(msg || 'No se pudo registrar. Intenta con otro nombre.');
    });

    // Listener para mensajes nuevos
    if (!socket) return;

    // Listeners solo si socket existe
    socket.on('registration-success', (data) => {
      setIsRegistered(true);
      setGuestId(data.guestId);
      setTotalScore(data.totalScore || 0);
      localStorage.setItem('guestData', JSON.stringify({ guestId: data.guestId, name: guestName }));
    });

    socket.on('registration-failed', (msg) => {
      alert(msg || 'No se pudo registrar. Intenta con otro nombre.');
    });

    socket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('new-emoji', (emojiData) => {
      setFloatingEmojis(prev => [
        ...prev,
        { ...emojiData, id: Date.now() + Math.random() }
      ]);
      setTimeout(() => {
        setFloatingEmojis(prev => prev.slice(1));
      }, 2500);
    });

    socket.on('drawing-game-started', ({ prompt, duration }) => {
      setDrawingPrompt(prompt);
      setDrawingCountdown(duration);
      setDrawingSubmitted(false);
      setEventState('drawing-active');
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    socket.on('drawing-countdown-update', (count) => {
      setDrawingCountdown(count);
    });

    socket.on('drawing-voting-started', ({ drawings, prompt }) => {
      setVotingDrawings(drawings || []);
      setDrawingPrompt(prompt || null);
      setEventState('drawing-voting');
    });

    return () => {
      socket.off('registration-success');
      socket.off('registration-failed');
      socket.off('new-message');
      socket.off('new-emoji');
      socket.off('drawing-game-started');
      socket.off('drawing-countdown-update');
      socket.off('drawing-voting-started');
    };
  }, [socket, guestName]);

  const submitTriviaAnswer = (e) => {
    e.preventDefault();
    if (triviaAnswer.trim() && socket) {
      socket.emit('trivia-response', { answer: triviaAnswer.trim() });
      setCurrentTrivia(null);
    }
  };

  const vote = (gender) => {
    if (socket) {
      socket.emit('final-vote', { vote: gender });
    }
  };

  // Funciones del minijuego de dibujo
  const initializeCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Configurar canvas
    canvas.width = 400;
    canvas.height = 300;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const startDrawing = (e) => {
    if (drawingSubmitted || drawingCountdown <= 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || drawingSubmitted || drawingCountdown <= 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (drawingSubmitted || drawingCountdown <= 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const submitDrawing = () => {
    if (!canvasRef.current || drawingSubmitted) return;
    
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    
    socket.emit('submit-drawing', { drawing: dataURL });
    setDrawingSubmitted(true);
  };

  const voteOnDrawing = (drawingId) => {
    if (!socket) return;
    setMyVotes(prev => {
      const newVotes = new Set(prev);
      if (newVotes.has(drawingId)) {
        newVotes.delete(drawingId);
      } else {
        newVotes.add(drawingId);
      }
      return newVotes;
    });
    socket.emit('vote-drawing', { drawingId });
  };

  const changeUser = () => {
    // Limpiar datos guardados
    localStorage.removeItem('guestData');
    
    // Resetear estado
    setIsRegistered(false);
    setGuestId(null);
    setGuestName('');
    setTotalScore(0);
    setTriviaPersonalResult(null);
    setResponseSubmitted(false);
    setTriviaAnswer('');
    setCurrentVote(null);
    setHasVoted(false);
    setMessages([]);
    setEventState('waiting');
    
    // Recargar la página para reiniciar completamente
    window.location.reload();
  };

  if (!isRegistered) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
            🎉 ¡Únete a la Revelación! 🎉
          </h2>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Tu nombre:</label>
              <input
                type="text"
                className="form-input"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ingresa tu nombre"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Entrar al Evento
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }}>
      <div className="animated-bg" />
      <div className="container">
        {/* Emojis flotantes */}
        {floatingEmojis.map((emoji) => (
          <div
            key={emoji.id}
            className="floating-emoji"
            style={{
              left: `${emoji.x}%`,
              top: `${emoji.y}%`,
            }}
          >
            {emoji.emoji}
          </div>
        ))}

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div></div>
            <h1 style={{ color: 'white', margin: 0 }}>
              ¡Hola {guestName}! 👋
            </h1>
            <button
              onClick={changeUser}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
              title="Cambiar a otro usuario"
            >
              👤 Cambiar Usuario
            </button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>
            Estado del evento: <strong>
              {eventState === 'waiting' && 'Esperando...'}
              {eventState === 'trivia-active' && '🧠 Trivia en curso'}
              {eventState === 'trivia-results' && '📊 Viendo resultados'}
              {eventState === 'trivia-finished' && '🏆 Trivia terminada'}
              {eventState === 'voting-active' && '🗳️ Votación activa'}
              {eventState === 'voting-finished' && '📊 Votación terminada'}
              {eventState === 'drawing-active' && '🎨 Dibujando'}
              {eventState === 'drawing-voting' && '🖼️ Votando dibujos'}
              {eventState === 'drawing-results' && '🏆 Resultados dibujo'}
              {eventState === 'countdown' && '⏰ Cuenta regresiva'}
              {eventState === 'revealed' && '🎊 ¡Revelado!'}
              {eventState === 'trivia-winner' && '🏆 ¡Ganador!'}
            </strong>
          </div>
          <div style={{ 
            background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '25px', 
            display: 'inline-block',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}>
            🏆 Puntuación: {totalScore} puntos
          </div>
      </div>

      {/* Trivia Activa */}
      {currentTrivia && eventState === 'trivia-active' && (
        <div className="card">
          <h2>🧠 Trivia - {currentTrivia.points} puntos</h2>
          <div style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '500' }}>
            {currentTrivia.question}
          </div>
          {!triviaPersonalResult && !responseSubmitted ? (
            <form onSubmit={submitTriviaAnswer}>
              <div className="form-group">
                {currentTrivia.options && currentTrivia.type === 'multiple-choice' ? (
                  <div style={{ textAlign: 'left' }}>
                    {currentTrivia.options.map((option, index) => (
                      <label key={index} style={{
                        display: 'block',
                        margin: '15px 0',
                        padding: '15px',
                        background: triviaAnswer === String.fromCharCode(65 + index)
                          ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
                          : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        border: triviaAnswer === String.fromCharCode(65 + index)
                          ? '2px solid #6c5ce7'
                          : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="radio"
                          name="trivia-option"
                          value={String.fromCharCode(65 + index)}
                          checked={triviaAnswer === String.fromCharCode(65 + index)}
                          onChange={() => setTriviaAnswer(String.fromCharCode(65 + index))}
                          style={{ marginRight: '10px' }}
                        />
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{String.fromCharCode(65 + index)}.</span>
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={triviaAnswer}
                    onChange={(e) => setTriviaAnswer(e.target.value)}
                    placeholder="Tu respuesta"
                    required
                  />
                )}
              </div>
              <button type="submit" className="btn btn-success">
                Enviar Respuesta
              </button>
            </form>
          ) : responseSubmitted ? (
            // Estado de esperando resultados
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ 
                fontSize: '24px', 
                marginBottom: '15px',
                color: '#28a745',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                ✅ Respuesta enviada
              </div>
              <div style={{ 
                fontSize: '16px', 
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '20px' 
              }}>
                Esperando a que el administrador muestre los resultados...
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'rgba(255,255,255,0.6)' 
              }}>
                🔄 Los puntos se calcularán cuando se revelen los resultados
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ 
                fontSize: '24px', 
                marginBottom: '15px',
                color: triviaPersonalResult.isCorrect ? '#28a745' : '#dc3545'
              }}>
                {triviaPersonalResult.isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto'}
              </div>
              <div style={{ fontSize: '16px', marginBottom: '10px' }}>
                Tu respuesta: <strong>{triviaAnswer}</strong>
              </div>
              <div style={{ fontSize: '16px', marginBottom: '10px' }}>
                Respuesta correcta: <strong>{triviaPersonalResult.correctAnswer}</strong>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                Puntos ganados: {triviaPersonalResult.points}
              </div>
              <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
                Esperando resultados generales...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado: Viendo resultados de pregunta */}
      {eventState === 'trivia-results' && triviaPersonalResult && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>📊 Resultado de tu Respuesta</h2>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '20px',
            color: triviaPersonalResult.isCorrect ? '#28a745' : '#dc3545'
          }}>
            {triviaPersonalResult.isCorrect ? '✅' : '❌'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>
            {triviaPersonalResult.isCorrect ? '¡Correcto!' : 'Incorrecto'}
          </div>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            Tu respuesta: <strong>{triviaAnswer}</strong>
          </div>
          <div style={{ fontSize: '18px', marginBottom: '15px' }}>
            Respuesta correcta: <strong>{triviaPersonalResult.correctAnswer}</strong>
          </div>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: triviaPersonalResult.isCorrect ? '#28a745' : '#6c757d'
          }}>
            Puntos ganados: +{triviaPersonalResult.points}
          </div>
          <div style={{ fontSize: '14px', marginTop: '20px', opacity: 0.8 }}>
            El administrador está mostrando los resultados en la pantalla principal
          </div>
        </div>
      )}


      {/* Resultados del Minijuego de Dibujo - Solo para el usuario actual */}
      {eventState === 'drawing-results' && drawingResults && (
        (() => {
          const myDrawingResult = drawingResults.scores && drawingResults.scores.find(r => r.guestId === guestId);
          if (!myDrawingResult) return null;
          return (
            <div className="card" style={{ textAlign: 'center' }}>
              <h2>🎨 Resultado de tu Dibujo</h2>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#00b894' }}>
                ¡Gracias por participar!
              </div>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                Tema: <strong>"{drawingResults.prompt}"</strong>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6c5ce7', marginBottom: '10px' }}>
                Puntos ganados: +{myDrawingResult.points}
              </div>
              <div style={{ fontSize: '14px', marginTop: '20px', opacity: 0.8 }}>
                El administrador está mostrando los resultados en la pantalla principal
              </div>
            </div>
          );
        })()
      )}

      {/* Esperando siguientes eventos */}
      {(eventState === 'trivia-finished' || eventState === 'voting-finished' || (eventState === 'drawing-results' && !drawingResults)) && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>⏳ Esperando...</h2>
          <div style={{ fontSize: '16px', opacity: 0.8 }}>
            {eventState === 'trivia-finished' && 'Trivia terminada. Esperando el siguiente evento...'}
            {eventState === 'voting-finished' && 'Votación terminada. Esperando el siguiente evento...'}
            {eventState === 'drawing-results' && 'Minijuego de dibujo terminado. Esperando el siguiente evento...'}
          </div>
        </div>
      )}

      {/* Minijuego de Dibujo Activo */}
      {eventState === 'drawing-active' && drawingPrompt && (
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            🎨 Minijuego de Dibujo
          </h2>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
            color: 'white',
            padding: '15px',
            borderRadius: '10px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              Dibuja: "{drawingPrompt}"
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              ⏰ Tiempo restante: {drawingCountdown}s
            </div>
          </div>

          {!drawingSubmitted ? (
            <div style={{ textAlign: 'center' }}>
              <canvas
                ref={canvasRef}
                style={{
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: drawingCountdown > 0 ? 'crosshair' : 'not-allowed',
                  marginBottom: '15px',
                  maxWidth: '100%',
                  background: 'white'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              
              <div style={{ marginBottom: '15px' }}>
                <button
                  onClick={clearCanvas}
                  disabled={drawingSubmitted || drawingCountdown <= 0}
                  style={{
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '5px',
                    cursor: drawingSubmitted || drawingCountdown <= 0 ? 'not-allowed' : 'pointer',
                    marginRight: '10px',
                    opacity: drawingSubmitted || drawingCountdown <= 0 ? 0.5 : 1
                  }}
                >
                  🗑️ Limpiar
                </button>
                
                <button
                  onClick={submitDrawing}
                  disabled={drawingSubmitted || drawingCountdown <= 0}
                  style={{
                    background: '#00b894',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '5px',
                    cursor: drawingSubmitted || drawingCountdown <= 0 ? 'not-allowed' : 'pointer',
                    opacity: drawingSubmitted || drawingCountdown <= 0 ? 0.5 : 1
                  }}
                >
                  📤 Enviar Dibujo
                </button>
              </div>
              
              <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)' }}>
                💡 Haz clic y arrastra para dibujar. El dibujo se enviará automáticamente cuando termine el tiempo.
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center',
              padding: '30px',
              background: 'rgba(0, 184, 148, 0.1)',
              borderRadius: '10px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                ¡Dibujo enviado!
              </div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>
                Esperando a que todos terminen de dibujar...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Votación de Dibujos */}
      {eventState === 'drawing-voting' && (
        votingDrawings && votingDrawings.length > 0 ? (
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            🖼️ Vota por los Mejores Dibujos
          </h2>
          
          <div style={{ 
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '16px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            Tema: "{drawingPrompt}" - {votingDrawings.length} dibujos para votar
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '20px'
          }}>
            {votingDrawings.map((drawing, index) => (
              <div key={drawing.id} style={{ 
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '15px',
                padding: '15px',
                textAlign: 'center',
                border: '2px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{
                  background: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <img
                    src={drawing.drawing}
                    alt={`Dibujo de ${drawing.guestName}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '150px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                  por: {drawing.guestName}
                </div>

                <button
                  onClick={() => voteOnDrawing(drawing.id)}
                  style={{
                    background: myVotes.has(drawing.id) 
                      ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
                      : 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                    color: 'white',
                    border: myVotes.has(drawing.id) ? '2px solid #e74c3c' : 'none',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease',
                    width: '100%'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {myVotes.has(drawing.id) ? '❌ Remover voto' : '👍 Votar'}
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ 
            fontSize: '12px', 
            opacity: 0.6, 
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            Puedes votar por múltiples dibujos
          </div>
        </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>🖼️ Votación de Dibujos</h2>
            <div style={{ fontSize: '18px', marginBottom: '20px' }}>
              No hay dibujos disponibles para votar
            </div>
            <div style={{ fontSize: '14px', opacity: 0.7 }}>
              Esperando a que se procesen los dibujos...
            </div>
          </div>
        )
      )}

      {/* Votación final */}
      {eventState === 'voting-active' && (
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
            🗳️ Votación Final: ¿Niño o Niña?
          </h2>
          <div className="voting-container">
            <div
              className={`vote-circle boy ${currentVote === 'boy' ? 'selected' : ''}`}
              style={{
                width: `${200 + (votingData.boy.count * 10)}px`,
                height: `${200 + (votingData.boy.count * 10)}px`,
                cursor: 'pointer',
                border: currentVote === 'boy' ? '4px solid #0066cc' : '2px solid rgba(255,255,255,0.3)'
              }}
              onClick={() => vote('boy')}
            >
              <div className="vote-count">{votingData.boy.count}</div>
              <div className="vote-label">👦 NIÑO</div>
              <div className="voter-bubbles">
                {votingData.boy.names.map((name, index) => (
                  <span key={index} className="voter-bubble">{name}</span>
                ))}
              </div>
            </div>

            <div
              className={`vote-circle girl ${currentVote === 'girl' ? 'selected' : ''}`}
              style={{
                width: `${200 + (votingData.girl.count * 10)}px`,
                height: `${200 + (votingData.girl.count * 10)}px`,
                cursor: 'pointer',
                border: currentVote === 'girl' ? '4px solid #ff69b4' : '2px solid rgba(255,255,255,0.3)'
              }}
              onClick={() => vote('girl')}
            >
              <div className="vote-count">{votingData.girl.count}</div>
              <div className="vote-label">👧 NIÑA</div>
              <div className="voter-bubbles">
                {votingData.girl.names.map((name, index) => (
                  <span key={index} className="voter-bubble">{name}</span>
                ))}
              </div>
            </div>
          </div>
          
          {hasVoted && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <div style={{ color: '#00b894', fontWeight: '600', marginBottom: '10px' }}>
                ✅ Has votado por: {currentVote === 'boy' ? '👦 NIÑO' : '👧 NIÑA'}
              </div>
              <div style={{ color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px' }}>
                💡 Puedes cambiar tu voto haciendo clic en el otro círculo
              </div>
            </div>
          )}
        </div>
      )}

      {/* Countdown */}
      {eventState === 'countdown' && (
        <div className="countdown-container">
          <h2 style={{ color: 'white', marginBottom: '30px' }}>
            🎊 ¡La revelación está por llegar! 🎊
          </h2>
          {countdown > 0 && (
            <div className="countdown-number">{countdown}</div>
          )}
          {countdown === 0 && (
            <div style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>
              🎉 ¡YA! 🎉
            </div>
          )}
        </div>
      )}

      {/* Revelación */}
      {eventState === 'revealed' && revealedGender && (
        <div className="reveal-container">
          <div className={`reveal-text ${revealedGender === 'boy' ? 'reveal-boy' : 'reveal-girl'}`}>
            {revealedGender === 'boy' ? '👦 ¡ES UN NIÑO! 👦' : '👧 ¡ES UNA NIÑA! 👧'}
          </div>
          <div style={{ fontSize: '24px', color: 'white', marginTop: '20px' }}>
            🎉 ¡Felicidades a America y Guillermo! 🎉
          </div>
        </div>
      )}

      {/* Pantalla Ganador de Trivia */}
      {eventState === 'trivia-winner' && triviaWinnerData && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: triviaWinnerData.winner && triviaWinnerData.winner.guestName === guestName ?
            'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)' :
            'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          color: 'white',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '120px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>
            {triviaWinnerData.winner && triviaWinnerData.winner.guestName === guestName ? '🏆' : '👏'}
          </div>
          
          {triviaWinnerData.winner && triviaWinnerData.winner.guestName === guestName ? (
            <>
              <h1 style={{ 
                fontSize: '48px', 
                fontWeight: 'bold',
                marginBottom: '20px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}>
                ¡ERES EL GANADOR!
              </h1>

              <div style={{
                fontSize: '28px',
                marginBottom: '30px',
                background: 'rgba(255,255,255,0.2)',
                padding: '20px 40px',
                borderRadius: '20px',
                backdropFilter: 'blur(10px)'
              }}>
                🎉 ¡Felicidades por tu conocimiento! 🎉
              </div>

              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                padding: '15px 30px',
                borderRadius: '25px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                marginBottom: '20px'
              }}>
                Tu puntuación: {totalScore} puntos
              </div>

              <div style={{ fontSize: '20px', opacity: 0.9, marginTop: '20px' }}>
                👑 ¡Felicidades! 👑
              </div>
            </>
          ) : (
            <>
              <h1 style={{ 
                fontSize: '48px', 
                fontWeight: 'bold',
                marginBottom: '20px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}>
                ¡Ganador!
              </h1>

              {triviaWinnerData.winner && (
                <div style={{
                  fontSize: '32px',
                  marginBottom: '30px',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '20px 40px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)'
                }}>
                  🎊 <strong>{triviaWinnerData.winner.guestName}</strong> 🎊
                </div>
              )}

              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                background: 'rgba(255,255,255,0.1)',
                padding: '15px 30px',
                borderRadius: '20px',
                marginBottom: '20px'
              }}>
                🏆 Puntuación ganadora: {triviaWinnerData.winner?.totalScore || 0} puntos
                {triviaWinnerData.winner && (
                  <div style={{ fontSize: '16px', marginTop: '8px', opacity: 0.8 }}>
                    Trivia: {triviaWinnerData.winner.triviaPoints} + Revelacion: {triviaWinnerData.winner.genderPoints}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '18px', opacity: 0.9 }}>
                Tu puntuación: {totalScore} puntos
              </div>

              <div style={{ fontSize: '20px', opacity: 0.9, marginTop: '20px' }}>
                👏 ¡Felicita al ganador! 👏
              </div>
            </>
          )}

          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
          `}</style>
        </div>
      )}

      {/* Chat y Emojis - Disponible excepto en momentos climáticos */}
      {!['countdown', 'revealed', 'trivia-winner', 'drawing-active', 'drawing-voting'].includes(eventState) && (
        <>
          {/* Emojis */}
          <div className="card">
            <h3>😊 Reacciones</h3>
            <div className="emoji-container">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  className="emoji-btn"
                  onClick={() => sendEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="card">
            <h3>💬 Chat en Vivo</h3>
            {eventState === 'trivia-active' && (
              <div style={{
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.3)',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '15px',
                fontSize: '14px',
                color: '#856404'
              }}>
                ⚠️ <strong>Trivia activa:</strong> Los mensajes que contengan respuestas serán censurados automáticamente.
              </div>
            )}
            <div className="chat-container">
              <div className="chat-messages">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`chat-message ${msg.isWinner ? 'winner-message' : ''}`}
                    style={{
                      background: msg.isWinner ? undefined : 
                                 msg.isSystem ? 'rgba(40, 167, 69, 0.1)' : 
                                 msg.censurado ? 'rgba(255, 193, 7, 0.1)' : '#f8f9fa',
                      borderLeft: msg.isWinner ? undefined :
                                 msg.isSystem ? '4px solid #28a745' :
                                 msg.censurado ? '4px solid #ffc107' : '4px solid #74b9ff',
                      fontStyle: msg.isSystem ? 'italic' : 'normal'
                    }}
                  >
                    <strong>{msg.name}:</strong> {msg.message}
                    {msg.censurado && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#ffc107',
                        fontWeight: 'bold' 
                      }}>
                        📝 (censurado)
                      </span>
                    )}
                    <span style={{ float: 'right', fontSize: '12px', color: '#666' }}>
                      {msg.timestamp}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="chat-input-container">
                <input
                  type="text"
                  className="chat-input"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                />
                <button type="submit" className="btn btn-primary">
                  Enviar
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      </div>
    </div>

  );
}

export default GuestInterface;

