import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const GuestInterface = () => {
  const [socket, setSocket] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestId, setGuestId] = useState('');
  const [eventState, setEventState] = useState('waiting');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [triviaAnswer, setTriviaAnswer] = useState('');
  const [triviaPersonalResult, setTriviaPersonalResult] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [votingData, setVotingData] = useState({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
  const [hasVoted, setHasVoted] = useState(false);
  const [currentVote, setCurrentVote] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [revealedGender, setRevealedGender] = useState(null);
  const [triviaWinnerData, setTriviaWinnerData] = useState(null);
  const messagesEndRef = useRef(null);

  const emojis = ['😍', '🥰', '😂', '🤗', '😮', '🎉', '💕', '👶', '🍼', '🎈'];

  useEffect(() => {
    const newSocket = io(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('new-emoji', (emojiData) => {
      const id = Date.now() + Math.random();
      setFloatingEmojis(prev => [...prev, { ...emojiData, id }]);
      
      // Remover emoji después de 3 segundos
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, 3000);
    });

    // Eventos del nuevo flujo
    newSocket.on('trivia-question-started', (trivia) => {
      setCurrentTrivia(trivia);
      setTriviaAnswer('');
      setTriviaPersonalResult(null);
      setEventState('trivia-active');
    });

    newSocket.on('trivia-personal-result', (result) => {
      setTriviaPersonalResult(result);
      // Actualizar puntuación total
      if (result.isCorrect) {
        setTotalScore(prev => prev + result.points);
      }
    });

    newSocket.on('trivia-question-results', (results) => {
      setEventState('trivia-results');
    });

    newSocket.on('trivia-final-results', (results) => {
      setCurrentTrivia(null);
      setEventState('trivia-finished');
    });

    newSocket.on('voting-started', () => {
      setEventState('voting-active');
      setHasVoted(false);
      setCurrentVote(null);
      setVotingData({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
    });

    newSocket.on('votes-update', (votes) => {
      setVotingData(votes);
    });

    newSocket.on('vote-confirmed', (data) => {
      setCurrentVote(data.vote);
      setHasVoted(true);
    });

    newSocket.on('voting-final-results', (results) => {
      setEventState('voting-finished');
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
    });

    newSocket.on('trivia-winner-revealed', (data) => {
      setEventState('trivia-winner');
      setTriviaWinnerData(data);
    });

    newSocket.on('event-reset', () => {
      setEventState('waiting');
      setCurrentTrivia(null);
      setTriviaPersonalResult(null);
      setTotalScore(0);
      setHasVoted(false);
      setCurrentVote(null);
      setCountdown(null);
      setRevealedGender(null);
      setVotingData({ boy: { count: 0, names: [] }, girl: { count: 0, names: [] } });
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRegister = (e) => {
    e.preventDefault();
    if (guestName.trim() && socket) {
      socket.emit('register-guest', { name: guestName.trim() });
      socket.on('registration-success', (data) => {
        setGuestId(data.guestId);
        setIsRegistered(true);
      });
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      socket.emit('send-message', { message: newMessage.trim() });
      setNewMessage('');
    }
  };

  const sendEmoji = (emoji) => {
    if (socket) {
      socket.emit('send-emoji', { emoji });
    }
  };

  const submitTriviaAnswer = (e) => {
    e.preventDefault();
    if (triviaAnswer.trim() && socket) {
      socket.emit('trivia-response', { answer: triviaAnswer.trim() });
      setCurrentTrivia(null);
    }
  };

  const vote = (gender) => {
    if (!hasVoted && socket) {
      socket.emit('final-vote', { vote: gender });
      setHasVoted(true);
    }
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
        <h1 style={{ color: 'white', marginBottom: '10px' }}>
          ¡Hola {guestName}! 👋
        </h1>
        <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>
          Estado del evento: <strong>
            {eventState === 'waiting' && 'Esperando...'}
            {eventState === 'trivia-active' && '🧠 Trivia en curso'}
            {eventState === 'trivia-results' && '📊 Viendo resultados'}
            {eventState === 'trivia-finished' && '🏆 Trivia terminada'}
            {eventState === 'voting-active' && '🗳️ Votación activa'}
            {eventState === 'voting-finished' && '📊 Votación terminada'}
            {eventState === 'countdown' && '⏰ Cuenta regresiva'}
            {eventState === 'revealed' && '🎊 ¡Revelado!'}
            {eventState === 'trivia-winner' && '🏆 ¡Ganador!'}
          </strong>
        </div>
        {totalScore > 0 && (
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
        )}
      </div>

      {/* Trivia Activa */}
      {currentTrivia && eventState === 'trivia-active' && (
        <div className="card">
          <h2>🧠 Trivia - {currentTrivia.points} puntos</h2>
          <div style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '500' }}>
            {currentTrivia.question}
          </div>
          {!triviaPersonalResult ? (
            <form onSubmit={submitTriviaAnswer}>
              <div className="form-group">
                <input
                  type={currentTrivia.type}
                  className="form-input"
                  value={triviaAnswer}
                  onChange={(e) => setTriviaAnswer(e.target.value)}
                  placeholder="Tu respuesta..."
                  required
                />
              </div>
              <button type="submit" className="btn btn-success">
                Enviar Respuesta
              </button>
            </form>
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

      {/* Esperando siguientes eventos */}
      {(eventState === 'trivia-finished' || eventState === 'voting-finished') && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>⏳ Esperando...</h2>
          <div style={{ fontSize: '16px', opacity: 0.8 }}>
            {eventState === 'trivia-finished' && 'Trivia terminada. Esperando el siguiente evento...'}
            {eventState === 'voting-finished' && 'Votación terminada. Esperando el siguiente evento...'}
          </div>
        </div>
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
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
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
            🎉 ¡Felicidades a los futuros papás! 🎉
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
                👑 ¡Eres el más inteligente del grupo! 👑
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
                    Trivia: {triviaWinnerData.winner.triviaPoints} + Adivinanza: {triviaWinnerData.winner.genderPoints}
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

      {/* Chat y Emojis - Solo si no está en countdown, revelación o ganador */}
      {!['countdown', 'revealed', 'trivia-winner'].includes(eventState) && (
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
            <div className="chat-container">
              <div className="chat-messages">
                {messages.map((msg) => (
                  <div key={msg.id} className="chat-message">
                    <strong>{msg.name}:</strong> {msg.message}
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
  );
};

export default GuestInterface;