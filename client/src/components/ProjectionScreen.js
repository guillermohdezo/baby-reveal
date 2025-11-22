import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Confetti from 'react-confetti';

const ProjectionScreen = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [eventState, setEventState] = useState('waiting');
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [triviaResults, setTriviaResults] = useState(null);
  const [votingData, setVotingData] = useState({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
  const [countdown, setCountdown] = useState(null);
  const [revealedGender, setRevealedGender] = useState(null);
  const [guests, setGuests] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Estados del minijuego de dibujo
  const [drawingPrompt, setDrawingPrompt] = useState(null);
  const [drawingCountdown, setDrawingCountdown] = useState(null);
  const [votingDrawings, setVotingDrawings] = useState([]);
  const [currentVotingIndex, setCurrentVotingIndex] = useState(0);
  const [drawingResults, setDrawingResults] = useState(null);
  const currentEventStateRef = useRef('waiting');

  // Actualizar la referencia cuando cambie el estado
  useEffect(() => {
    currentEventStateRef.current = eventState;
  }, [eventState]);

  useEffect(() => {
    const newSocket = io(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('guest-update', (guestList) => {
      setGuests(guestList);
    });

    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev.slice(-4), message]); // Solo mostrar últimos 5 mensajes
    });

    newSocket.on('new-emoji', (emojiData) => {
      const id = Date.now() + Math.random();
      setFloatingEmojis(prev => [...prev, { ...emojiData, id }]);
      
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, 4000);
    });

    // Nuevos eventos del flujo estructurado
    newSocket.on('trivia-question-started', (trivia) => {
      setCurrentTrivia(trivia);
      setTriviaResults(null);
      setEventState('trivia-active');
    });

    newSocket.on('trivia-question-results', (results) => {
      setTriviaResults(results);
      setEventState('trivia-results');
    });

    newSocket.on('trivia-final-results', (results) => {
      setTriviaResults(results);
      setCurrentTrivia(null);
      setEventState('trivia-final');
    });

    newSocket.on('voting-started', () => {
      setEventState('voting-active');
      setVotingData({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
    });

    newSocket.on('voting-final-results', (results) => {
      setEventState('voting-results');
    });

    newSocket.on('votes-update', (votes) => {
      setVotingData(votes);
    });

    newSocket.on('countdown-started', () => {
      setEventState('countdown');
      setCountdown(5);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    newSocket.on('gender-revealed', (data) => {
      setEventState('revealed');
      setRevealedGender(data.gender);
      setShowConfetti(true);
      
      // Detener confetti después de 10 segundos
      setTimeout(() => {
        setShowConfetti(false);
      }, 10000);
    });

    newSocket.on('trivia-winner-revealed', (data) => {
      setEventState('trivia-winner');
      setTriviaResults(data);
    });

    // Eventos del minijuego de dibujo
    newSocket.on('drawing-game-started', (data) => {
      setEventState('drawing-active');
      setDrawingPrompt(data.prompt);
      setDrawingCountdown(data.duration);
      
      // Iniciar countdown
      const countdownInterval = setInterval(() => {
        setDrawingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    newSocket.on('drawing-voting-started', (data) => {
      setEventState('drawing-voting');
      setVotingDrawings(data.drawings || []);
      setDrawingPrompt(data.prompt || 'Dibujo libre');
      setCurrentVotingIndex(0);
    });

    newSocket.on('drawing-results', (data) => {
      setEventState('drawing-results');
      setDrawingResults(data);
    });

    newSocket.on('drawing-votes-update', (data) => {
      console.log('Recibiendo actualización de votos:', data);
      console.log('Estado actual:', currentEventStateRef.current);
      // Actualizar votos en tiempo real solo si estamos en modo votación
      setVotingDrawings(prevDrawings => {
        if (currentEventStateRef.current === 'drawing-voting') {
          console.log('Actualizando votos en pantalla de proyección');
          return data.drawings || [];
        }
        return prevDrawings;
      });
    });

    newSocket.on('event-reset', () => {
      setEventState('waiting');
      setCurrentTrivia(null);
      setTriviaResults(null);
      setCountdown(null);
      setRevealedGender(null);
      setShowConfetti(false);
      setMessages([]);
      setFloatingEmojis([]);
      setGuests([]);
      setVotingData({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
      
      // Reset drawing states
      setDrawingPrompt(null);
      setDrawingCountdown(null);
      setVotingDrawings([]);
      setCurrentVotingIndex(0);
      setDrawingResults(null);
    });

    return () => newSocket.close();
  }, []);

  const renderWaitingScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{ fontSize: '72px', marginBottom: '30px' }}>
        🎉
      </div>
      <h1 style={{ fontSize: '64px', marginBottom: '20px', fontWeight: 'bold' }}>
        ¡Revelación de Sexo!
      </h1>
      <div style={{ fontSize: '32px', marginBottom: '40px', opacity: 0.9 }}>
        Esperando a que comience la diversión...
      </div>
      <div style={{ fontSize: '24px', marginBottom: '20px' }}>
        👥 {guests.length} invitados conectados
      </div>
      
      {/* Mensajes del chat */}
      {messages && messages.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '50px',
          right: '50px',
          width: '400px',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '20px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>💬 Chat en Vivo</h3>
          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              marginBottom: '10px',
              padding: '8px 12px',
              background: msg.censurado ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '16px',
              border: msg.censurado ? '1px solid rgba(255, 193, 7, 0.4)' : 'none'
            }}>
              <strong>{msg.name}:</strong> {msg.message}
              {msg.censurado && (
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '12px', 
                  color: '#ffc107',
                  fontWeight: 'bold' 
                }}>
                  🚫
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTriviaScreen = () => (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
      color: 'white',
      padding: '40px'
    }}>
      {/* Lado izquierdo - Trivia */}
      <div style={{ 
        flex: '1', 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        paddingRight: '20px'
      }}>
        <div style={{ fontSize: '96px', marginBottom: '40px' }}>
          🧠
        </div>
        <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
          ¡Trivia en Curso!
        </h1>
        <div style={{ 
          fontSize: '36px', 
          marginBottom: '40px', 
          maxWidth: '600px',
          background: 'rgba(255,255,255,0.1)',
          padding: '30px',
          borderRadius: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          {currentTrivia?.question}
        </div>
        <div style={{ fontSize: '24px', opacity: 0.9 }}>
          {currentTrivia?.points} puntos | Los invitados están respondiendo...
        </div>
      </div>

      {/* Lado derecho - Chat en vivo */}
      <div style={{
        width: '400px',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh'
      }}>
        <h3 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '24px' }}>
          💬 Chat en Vivo
        </h3>
        
        <div style={{
          background: 'rgba(255, 193, 7, 0.2)',
          border: '1px solid rgba(255, 193, 7, 0.4)',
          borderRadius: '10px',
          padding: '10px',
          marginBottom: '15px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          🛡️ Mensajes con respuestas censurados automáticamente
        </div>

        <div style={{
          flex: '1',
          overflowY: 'auto',
          marginBottom: '20px',
          maxHeight: 'calc(80vh - 140px)'
        }}>
          {!messages || messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              opacity: 0.6,
              fontStyle: 'italic',
              marginTop: '50px' 
            }}>
              No hay mensajes aún...
            </div>
          ) : (
            messages.slice(-10).map((msg) => (
              <div key={msg.id} style={{ 
                marginBottom: '12px',
                padding: '10px 15px',
                background: msg.censurado ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '16px',
                border: msg.censurado ? '1px solid rgba(255, 193, 7, 0.4)' : 'none',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {msg.name}
                  {msg.censurado && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '12px', 
                      color: '#ffc107',
                      background: 'rgba(255, 193, 7, 0.3)',
                      padding: '2px 6px',
                      borderRadius: '8px'
                    }}>
                      🚫 CENSURADO
                    </span>
                  )}
                </div>
                <div style={{ wordWrap: 'break-word' }}>{msg.message}</div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                  {msg.timestamp}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  const renderTriviaResults = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        📊
      </div>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        Resultados de la Pregunta
      </h1>
      
      <div style={{ 
        fontSize: '28px', 
        marginBottom: '40px',
        background: 'rgba(255,255,255,0.1)',
        padding: '20px',
        borderRadius: '15px',
        backdropFilter: 'blur(10px)'
      }}>
        <strong>Pregunta:</strong> {triviaResults?.question}
        <br />
        <strong>Respuesta correcta:</strong> {triviaResults?.correctAnswer}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px',
        width: '100%',
        maxWidth: '1000px'
      }}>
        {triviaResults?.results?.map((result, index) => (
          <div key={index} style={{
            background: result.isCorrect ? 'rgba(0, 184, 148, 0.3)' : 'rgba(231, 76, 60, 0.3)',
            padding: '20px',
            borderRadius: '15px',
            border: `3px solid ${result.isCorrect ? '#00b894' : '#e74c3c'}`,
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
              {result.guestName}
            </div>
            <div style={{ fontSize: '20px', marginBottom: '10px' }}>
              Respuesta: {result.answer}
            </div>
            <div style={{ fontSize: '18px' }}>
              {result.isCorrect ? `✅ Correcto (+${result.points} puntos)` : '❌ Incorrecto'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTriviaFinalResults = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        🏆
      </div>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        🎉 Resultados Finales de la Trivia 🎉
      </h1>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '800px'
      }}>
        {triviaResults?.finalScores?.map((score, index) => (
          <div key={index} style={{
            background: index === 0 ? 'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)' 
                     : index === 1 ? 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)'
                     : index === 2 ? 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)'
                     : 'rgba(255,255,255,0.1)',
            padding: '25px',
            borderRadius: '20px',
            border: index < 3 ? `4px solid ${index === 0 ? '#f1c40f' : index === 1 ? '#95a5a6' : '#e67e22'}` : '2px solid rgba(255,255,255,0.3)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '48px' }}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️'}
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {score.guestName}
                </div>
                <div style={{ fontSize: '18px', opacity: 0.9 }}>
                  Posición #{index + 1}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
              {score.totalScore} pts
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderVotingResults = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        📊
      </div>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        Resultados de la Votación
      </h1>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center',
        width: '100%',
        maxWidth: '1000px',
        marginBottom: '40px'
      }}>
        {/* Resultado Niño */}
        <div style={{
          background: 'linear-gradient(45deg, #74b9ff, #0984e3)',
          padding: '40px',
          borderRadius: '30px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          minWidth: '300px'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>👦</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
            NIÑO
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
            {votingData.boy.count} votos
          </div>
        </div>

        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '0 40px' }}>
          VS
        </div>

        {/* Resultado Niña */}
        <div style={{
          background: 'linear-gradient(45deg, #fd79a8, #e84393)',
          padding: '40px',
          borderRadius: '30px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          minWidth: '300px'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>👧</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
            NIÑA
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
            {votingData.girl.count} votos
          </div>
        </div>
      </div>

      <div style={{ 
        fontSize: '32px', 
        fontWeight: 'bold',
        background: 'rgba(255,255,255,0.1)',
        padding: '20px 40px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        Total de votos: {votingData.boy.count + votingData.girl.count}
      </div>
    </div>
  );

  const renderVotingScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fd79a8 0%, #fdcb6e 50%, #74b9ff 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        🗳️
      </div>
      <h1 style={{ fontSize: '64px', marginBottom: '40px', fontWeight: 'bold' }}>
        ¡Votación Final!
      </h1>
      <h2 style={{ fontSize: '36px', marginBottom: '50px', opacity: 0.9 }}>
        ¿Niño o Niña?
      </h2>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center',
        width: '100%',
        maxWidth: '1000px'
      }}>
        {/* Círculo Niño */}
        <div style={{
          width: `${300 + (votingData.boy.count * 15)}px`,
          height: `${300 + (votingData.boy.count * 15)}px`,
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #74b9ff, #0984e3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.5s ease',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          margin: '20px'
        }}>
          <div style={{ fontSize: '72px', fontWeight: 'bold', marginBottom: '10px' }}>
            {votingData.boy.count}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '600', marginBottom: '15px' }}>
            👦 NIÑO
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'center',
            gap: '8px',
            maxWidth: `${250 + (votingData.boy.count * 10)}px`,
            overflow: 'hidden'
          }}>
            {votingData.boy.names.map((name, index) => (
              <span key={index} style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '14px',
                margin: '2px',
                backdropFilter: 'blur(5px)'
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* VS */}
        <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '0 40px' }}>
          VS
        </div>

        {/* Círculo Niña */}
        <div style={{
          width: `${300 + (votingData.girl.count * 15)}px`,
          height: `${300 + (votingData.girl.count * 15)}px`,
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #fd79a8, #e84393)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.5s ease',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          margin: '20px'
        }}>
          <div style={{ fontSize: '72px', fontWeight: 'bold', marginBottom: '10px' }}>
            {votingData.girl.count}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '600', marginBottom: '15px' }}>
            👧 NIÑA
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'center',
            gap: '8px',
            maxWidth: `${250 + (votingData.girl.count * 10)}px`,
            overflow: 'hidden'
          }}>
            {votingData.girl.names.map((name, index) => (
              <span key={index} style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '14px',
                margin: '2px',
                backdropFilter: 'blur(5px)'
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '40px', fontSize: '24px', opacity: 0.9 }}>
        Total de votos: {votingData.boy.count + votingData.girl.count}
      </div>
    </div>
  );

  const renderCountdownScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
      color: 'white',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)`,
        animation: countdown > 0 ? 'pulse 1s infinite' : 'none'
      }}></div>
      
      <h1 style={{ fontSize: '48px', marginBottom: '40px', fontWeight: 'bold', zIndex: 1 }}>
        🎊 ¡La revelación está por llegar! 🎊
      </h1>
      
      {countdown > 0 && (
        <div style={{ 
          fontSize: '200px', 
          fontWeight: 'bold',
          textShadow: '0 0 50px rgba(255,255,255,0.8)',
          animation: 'bounce 1s infinite',
          zIndex: 1
        }}>
          {countdown}
        </div>
      )}
      
      {countdown === 0 && (
        <div style={{ 
          fontSize: '96px', 
          fontWeight: 'bold',
          textShadow: '0 0 50px rgba(255,255,255,0.8)',
          animation: 'glow 0.5s infinite alternate',
          zIndex: 1
        }}>
          🎉 ¡YA! 🎉
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        
        @keyframes glow {
          0% { text-shadow: 0 0 50px rgba(255,255,255,0.8); }
          100% { text-shadow: 0 0 80px rgba(255,255,255,1), 0 0 100px rgba(255,255,255,0.8); }
        }
      `}</style>
    </div>
  );

  const renderRevealScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: revealedGender === 'boy' 
        ? 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
        : 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
      color: 'white',
      textAlign: 'center',
      position: 'relative'
    }}>
      {showConfetti && <Confetti />}
      
      <div style={{ fontSize: '200px', marginBottom: '40px', animation: 'bounce 2s infinite' }}>
        {revealedGender === 'boy' ? '👦' : '👧'}
      </div>
      
      <h1 style={{ 
        fontSize: '96px', 
        fontWeight: 'bold',
        marginBottom: '30px',
        textShadow: '0 0 30px rgba(0,0,0,0.3)',
        animation: 'glow 2s infinite alternate'
      }}>
        {revealedGender === 'boy' ? '¡ES UN NIÑO!' : '¡ES UNA NIÑA!'}
      </h1>
      
      <div style={{ fontSize: '48px', marginTop: '40px', opacity: 0.9 }}>
        🎉 ¡Felicidades a America y Guillermo! 🎉
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        
        @keyframes glow {
          0% { text-shadow: 0 0 30px rgba(0,0,0,0.3); }
          100% { text-shadow: 0 0 50px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.3); }
        }
      `}</style>
    </div>
  );

  const renderDrawingScreen = () => (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
      color: 'white',
      padding: '40px'
    }}>
      {/* Lado izquierdo - Dibujo */}
      <div style={{ 
        flex: '1', 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        paddingRight: '20px'
      }}>
        <div style={{ fontSize: '96px', marginBottom: '40px' }}>
          🎨
        </div>
        <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
          ¡Minijuego de Dibujo!
        </h1>
        <div style={{ 
          fontSize: '36px', 
          marginBottom: '30px', 
          maxWidth: '600px',
          background: 'rgba(255,255,255,0.1)',
          padding: '30px',
          borderRadius: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          Tema: "{drawingPrompt}"
        </div>
        
        <div style={{
          fontSize: '48px',
          fontWeight: 'bold',
          background: drawingCountdown <= 10 ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : 'rgba(255,255,255,0.1)',
          padding: '20px 40px',
          borderRadius: '25px',
          marginBottom: '20px',
          animation: drawingCountdown <= 10 ? 'pulse 1s infinite' : 'none'
        }}>
          ⏰ {drawingCountdown}s
        </div>
        
        <div style={{ fontSize: '24px', opacity: 0.9 }}>
          Los invitados están dibujando...
        </div>
      </div>

      {/* Lado derecho - Chat en vivo */}
      <div style={{
        width: '400px',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh'
      }}>
        <h3 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '24px' }}>
          💬 Chat en Vivo
        </h3>
        
        <div style={{
          background: 'rgba(108, 92, 231, 0.2)',
          border: '1px solid rgba(108, 92, 231, 0.4)',
          borderRadius: '10px',
          padding: '10px',
          marginBottom: '15px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          🎨 ¡Los invitados están concentrados dibujando!
        </div>

        <div style={{
          flex: '1',
          overflowY: 'auto',
          marginBottom: '20px',
          maxHeight: 'calc(80vh - 140px)'
        }}>
          {!messages || messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              opacity: 0.6,
              fontStyle: 'italic',
              marginTop: '50px' 
            }}>
              Silencio... están dibujando 🤫
            </div>
          ) : (
            messages.slice(-10).map((msg) => (
              <div key={msg.id} style={{ 
                marginBottom: '12px',
                padding: '10px 15px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '16px',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {msg.name}
                </div>
                <div style={{ wordWrap: 'break-word' }}>{msg.message}</div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                  {msg.timestamp}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderDrawingVotingScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        🖼️
      </div>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        ¡Vota por los Mejores Dibujos!
      </h1>
      
      <div style={{ 
        fontSize: '24px', 
        marginBottom: '40px',
        background: 'rgba(255,255,255,0.1)',
        padding: '15px 30px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        Tema: "{drawingPrompt}"
      </div>

      {votingDrawings && votingDrawings.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          width: '100%',
          maxWidth: '1200px'
        }}>
          {votingDrawings.map((drawing, index) => (
            <div key={drawing.id} style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '20px',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                background: 'white',
                padding: '10px',
                borderRadius: '10px',
                marginBottom: '15px'
              }}>
                <img
                  src={drawing.drawing}
                  alt={`Dibujo de ${drawing.guestName}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    border: '2px solid #ddd',
                    borderRadius: '5px'
                  }}
                />
              </div>
              
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
                por: {drawing.guestName}
              </div>
              
              <div style={{
                fontSize: '16px',
                background: 'rgba(0, 184, 148, 0.2)',
                padding: '8px 16px',
                borderRadius: '15px',
                display: 'inline-block'
              }}>
                👍 {drawing.votes || 0} votos
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ 
        fontSize: '20px', 
        marginTop: '40px',
        opacity: 0.8
      }}>
        Los invitados están votando desde sus dispositivos...
      </div>
    </div>
  );

  const renderDrawingResultsScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <Confetti />
      
      <div style={{ fontSize: '96px', marginBottom: '40px' }}>
        🏆
      </div>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        🎨 Resultados del Minijuego de Dibujo 🎨
      </h1>
      
      <div style={{ 
        fontSize: '24px', 
        marginBottom: '40px',
        background: 'rgba(255,255,255,0.1)',
        padding: '15px 30px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        Tema: "{drawingResults?.prompt || drawingPrompt}"
      </div>

      {/* Mostrar ganador destacado */}
      {drawingResults && drawingResults.winner && (
        <div style={{
          background: 'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)',
          padding: '30px',
          borderRadius: '25px',
          marginBottom: '40px',
          border: '4px solid #f1c40f',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>
            👑
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '15px' }}>
            ¡GANADOR!
          </h2>
          <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '15px' }}>
            {drawingResults.winner.guestName}
          </div>
          <div style={{ fontSize: '28px', marginBottom: '15px' }}>
            👍 {drawingResults.winner.votes} votos
          </div>
          {drawingResults.pointsAwarded > 0 && (
            <div style={{ 
              fontSize: '24px', 
              marginBottom: '20px',
              background: 'rgba(255,255,255,0.2)',
              padding: '10px 20px',
              borderRadius: '15px',
              display: 'inline-block'
            }}>
              🎯 +{drawingResults.pointsAwarded} puntos otorgados
            </div>
          )}
          <div style={{
            background: 'white',
            padding: '10px',
            borderRadius: '10px',
            display: 'inline-block'
          }}>
            <img
              src={drawingResults.winner.drawing}
              alt={`Dibujo ganador de ${drawingResults.winner.guestName}`}
              style={{
                maxWidth: '200px',
                maxHeight: '150px',
                border: '2px solid #f1c40f',
                borderRadius: '5px'
              }}
            />
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div style={{
        display: 'flex',
        gap: '30px',
        marginBottom: '40px',
        fontSize: '20px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '15px 25px',
          borderRadius: '15px'
        }}>
          🎨 {drawingResults?.rankings?.length || 0} Dibujos
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '15px 25px',
          borderRadius: '15px'
        }}>
          👥 {drawingResults?.totalParticipants || 0} Participantes
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '15px 25px',
          borderRadius: '15px'
        }}>
          👍 {drawingResults?.totalVotes || 0} Votos Totales
        </div>
      </div>

      {/* Ranking completo */}
      {drawingResults && drawingResults.rankings && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '15px',
          width: '100%',
          maxWidth: '900px'
        }}>
          <h3 style={{ fontSize: '28px', marginBottom: '20px' }}>
            📊 Ranking Completo
          </h3>
          {drawingResults.rankings.map((result, index) => (
            <div key={result.guestId} style={{
              background: index === 0 ? 'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)' 
                       : index === 1 ? 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)'
                       : index === 2 ? 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)'
                       : 'rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '15px',
              border: index < 3 ? `3px solid ${index === 0 ? '#f1c40f' : index === 1 ? '#95a5a6' : '#e67e22'}` : '2px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: index === 0 ? 1 : 0.9
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ fontSize: '36px' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}°`}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {result.guestName}
                  </div>
                  {index === 0 && (
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>
                      🏆 ¡Mejor artista!
                    </div>
                  )}
                </div>
                <div style={{
                  background: 'white',
                  padding: '5px',
                  borderRadius: '5px',
                  marginLeft: '20px'
                }}>
                  <img
                    src={result.drawing}
                    alt={`Dibujo de ${result.guestName}`}
                    style={{
                      width: '60px',
                      height: '45px',
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                👍 {result.votes}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTriviaWinnerScreen = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f1c40f 0%, #f39c12 50%, #e67e22 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '40px'
    }}>
      <Confetti />
      
      <div style={{ fontSize: '200px', marginBottom: '40px', animation: 'bounce 2s infinite' }}>
        🏆
      </div>
      
      <h1 style={{ 
        fontSize: '96px', 
        fontWeight: 'bold',
        marginBottom: '40px',
        textShadow: '0 0 30px rgba(0,0,0,0.3)',
        animation: 'glow 2s infinite alternate'
      }}>
        ¡GANADOR!
      </h1>
      
      {triviaResults?.winner && (
        <>
          <div style={{ 
            fontSize: '64px', 
            fontWeight: 'bold',
            marginBottom: '30px',
            background: 'rgba(255,255,255,0.2)',
            padding: '30px 60px',
            borderRadius: '30px',
            backdropFilter: 'blur(10px)'
          }}>
            👑 {triviaResults.winner.guestName} 👑
          </div>

          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
            padding: '20px 40px',
            borderRadius: '25px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            {triviaResults.winner.totalScore} PUNTOS
          </div>

          {/* Desglose de puntos */}
          <div style={{
            fontSize: '28px',
            marginBottom: '40px',
            background: 'rgba(255,255,255,0.1)',
            padding: '15px 30px',
            borderRadius: '15px',
            opacity: 0.9
          }}>
            🧠 Trivia: {triviaResults.winner.triviaPoints} + 🎨 Dibujo: {triviaResults.winner.drawingPoints || 0} + 🎯 Revelacion: {triviaResults.winner.genderPoints}
          </div>          <div style={{ fontSize: '36px', marginBottom: '40px', opacity: 0.9 }}>
            🎉 ¡Felicidades! 🎉
          </div>
        </>
      )}

      {/* Ranking de todos los participantes */}
      {triviaResults?.allScores && triviaResults.allScores.length > 1 && (
        <div style={{ 
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '800px',
          width: '100%',
          marginTop: '20px'
        }}>
          <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>📊 Ranking Final</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {triviaResults.allScores.slice(0, 5).map((player, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: index === 0 ? 'rgba(241, 196, 15, 0.3)' : 'rgba(255,255,255,0.1)',
                padding: '15px 25px',
                borderRadius: '15px',
                fontSize: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '32px' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️'}
                  </span>
                  <div>
                    <div>{player.guestName}</div>
                    <div style={{ fontSize: '16px', opacity: 0.7 }}>
                      🧠{player.triviaPoints || 0} + 🎨{player.drawingPoints || 0} + 🎯{player.genderPoints || 0}
                    </div>
                  </div>
                </div>
                <span style={{ fontWeight: 'bold' }}>{player.totalScore} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        
        @keyframes glow {
          0% { text-shadow: 0 0 30px rgba(0,0,0,0.3); }
          100% { text-shadow: 0 0 50px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.3); }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }}>
      <div className="animated-bg" />
      {/* Emojis flotantes */}
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          style={{
            position: 'fixed',
            left: `${emoji.x}%`,
            top: `${emoji.y}%`,
            fontSize: '48px',
            animation: 'float 4s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {emoji.emoji}
        </div>
      ))}

      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-300px) scale(0.3) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* Contenido principal basado en el estado del evento */}
      {eventState === 'waiting' && renderWaitingScreen()}
      {eventState === 'trivia-active' && renderTriviaScreen()}
      {eventState === 'trivia-results' && renderTriviaResults()}
      {eventState === 'trivia-final' && renderTriviaFinalResults()}
      {eventState === 'voting-active' && renderVotingScreen()}
      {eventState === 'voting-results' && renderVotingResults()}
      {eventState === 'drawing-active' && renderDrawingScreen()}
      {eventState === 'drawing-voting' && renderDrawingVotingScreen()}
      {eventState === 'drawing-results' && renderDrawingResultsScreen()}
      {eventState === 'countdown' && renderCountdownScreen()}
      {eventState === 'revealed' && renderRevealScreen()}
      {eventState === 'trivia-winner' && renderTriviaWinnerScreen()}
    </div>
  );
};

export default ProjectionScreen;