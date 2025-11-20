import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const AdminPanel = () => {
  const [socket, setSocket] = useState(null);
  const [triviaQuestions, setTriviaQuestions] = useState([]);
  const [guests, setGuests] = useState([]);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    correctAnswer: '',
    points: 10,
    type: 'text'
  });
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [babyGender, setBabyGender] = useState('');
  const [eventStatus, setEventStatus] = useState({});
  const [triviaResponses, setTriviaResponses] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState(new Set());

  const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    // Cargar datos iniciales
    loadTriviaQuestions();
    loadGender();
    loadStatus();

    newSocket.on('guest-update', (guestList) => {
      setGuests(guestList);
    });

    newSocket.on('trivia-response-received', (data) => {
      setTriviaResponses(data.totalResponses);
    });

    newSocket.on('event-reset', () => {
      setUsedQuestions(new Set());
      setTriviaResponses(0);
    });

    return () => newSocket.close();
  }, []);

  // Actualizar estado cada 2 segundos para mantener información actualizada
  useEffect(() => {
    const interval = setInterval(() => {
      loadStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const loadTriviaQuestions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/trivia`);
      setTriviaQuestions(response.data);
    } catch (error) {
      console.error('Error cargando preguntas:', error);
    }
  };

  const loadGender = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/gender`);
      setBabyGender(response.data.gender || '');
    } catch (error) {
      console.error('Error cargando género:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/status`);
      setEventStatus(response.data);
    } catch (error) {
      console.error('Error cargando estado:', error);
    }
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    try {
      if (editingQuestion) {
        await axios.put(`${API_BASE}/api/trivia/${editingQuestion.id}`, newQuestion);
        setEditingQuestion(null);
      } else {
        await axios.post(`${API_BASE}/api/trivia`, newQuestion);
      }
      
      setNewQuestion({
        question: '',
        correctAnswer: '',
        points: 10,
        type: 'text'
      });
      
      loadTriviaQuestions();
    } catch (error) {
      console.error('Error guardando pregunta:', error);
    }
  };

  const editQuestion = (question) => {
    setEditingQuestion(question);
    setNewQuestion({
      question: question.question,
      correctAnswer: question.correctAnswer,
      points: question.points,
      type: question.type
    });
  };

  const deleteQuestion = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar esta pregunta?')) {
      try {
        await axios.delete(`${API_BASE}/api/trivia/${id}`);
        loadTriviaQuestions();
      } catch (error) {
        console.error('Error eliminando pregunta:', error);
      }
    }
  };

  const saveGender = async () => {
    try {
      await axios.post(`${API_BASE}/api/gender`, { gender: babyGender });
      // Género guardado exitosamente
    } catch (error) {
      console.error('Error guardando género:', error);
    }
  };

  // Nuevos controles del flujo estructurado
  const startTriviaQuestion = (questionId) => {
    if (socket && !usedQuestions.has(questionId)) {
      socket.emit('admin-start-trivia-question', questionId);
      setTriviaResponses(0);
      // Marcar la pregunta como usada
      setUsedQuestions(prev => new Set([...prev, questionId]));
    }
  };

  const showQuestionResults = () => {
    if (socket && canShowResults()) {
      socket.emit('admin-show-question-results');
    }
  };

  // Función para verificar si se pueden mostrar los resultados
  const canShowResults = () => {
    const totalGuests = eventStatus.guestCount || 0;
    const responses = triviaResponses || 0;
    return totalGuests > 0 && responses >= totalGuests;
  };

  const endTrivia = () => {
    if (socket) {
      socket.emit('admin-end-trivia');
    }
  };

  const startVoting = () => {
    if (socket) {
      socket.emit('admin-start-voting');
    }
  };

  const endVoting = () => {
    if (socket) {
      socket.emit('admin-end-voting');
    }
  };

  const startCountdown = () => {
    if (socket) {
      socket.emit('admin-start-countdown');
    }
  };

  const revealGender = () => {
    if (socket && babyGender) {
      socket.emit('admin-reveal-gender');
    }
  };

  const showTriviaWinner = () => {
    if (socket) {
      socket.emit('admin-show-trivia-winner');
    }
  };

  const resetEvent = () => {
    if (window.confirm('¿Estás seguro de reiniciar todo el evento?')) {
      if (socket) {
        socket.emit('admin-reset-event');
        setTriviaResponses(0);
        setUsedQuestions(new Set()); // Reiniciar preguntas usadas
      }
    }
  };

  const cancelEdit = () => {
    setEditingQuestion(null);
    setNewQuestion({
      question: '',
      correctAnswer: '',
      points: 10,
      type: 'text'
    });
  };

  return (
    <div className="admin-panel">
      <div className="container">
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '30px' }}>
          🎛️ Panel de Administración
        </h1>

        <div className="admin-grid">
          {/* Estado del evento */}
          <div className="admin-card">
            <h2>📊 Estado del Evento</h2>
            <div style={{ marginBottom: '15px' }}>
              <span className={`status-indicator ${guests.length > 0 ? 'status-active' : 'status-inactive'}`}></span>
              Invitados conectados: {guests.length}
            </div>
            <div style={{ marginBottom: '15px' }}>
              Estado actual: <strong>{eventStatus.eventState || 'Cargando...'}</strong>
            </div>
            {eventStatus.currentTrivia && (
              <div style={{ marginBottom: '15px' }}>
                Trivia activa: {eventStatus.currentTrivia.question}
                <br />
                Respuestas recibidas: {triviaResponses}
              </div>
            )}
            <div style={{ marginBottom: '15px' }}>
              <a href="/projection" target="_blank" className="btn btn-primary">
                🖥️ Abrir Pantalla de Proyección
              </a>
            </div>
          </div>

          {/* Configuración del género */}
          <div className="admin-card">
            <h2>👶 Configuración del Bebé</h2>
            <div className="form-group">
              <label className="form-label">Género del bebé:</label>
              <select
                className="form-input"
                value={babyGender}
                onChange={(e) => setBabyGender(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                <option value="boy">Niño 👦</option>
                <option value="girl">Niña 👧</option>
              </select>
            </div>
            <button onClick={saveGender} className="btn btn-success">
              Guardar Género
            </button>
          </div>
        </div>

        {/* Gestión de Trivia */}
        <div className="admin-card">
          <h2>🧠 Gestión de Trivia</h2>
          
          <form onSubmit={saveQuestion} style={{ marginBottom: '30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label className="form-label">Pregunta:</label>
                <input
                  type="text"
                  className="form-input"
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Respuesta correcta:</label>
                <input
                  type="text"
                  className="form-input"
                  value={newQuestion.correctAnswer}
                  onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label className="form-label">Puntos:</label>
                <input
                  type="number"
                  className="form-input"
                  value={newQuestion.points}
                  onChange={(e) => setNewQuestion({...newQuestion, points: parseInt(e.target.value)})}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de input:</label>
                <select
                  className="form-input"
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion({...newQuestion, type: e.target.value})}
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="email">Email</option>
                  <option value="date">Fecha</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                {editingQuestion ? 'Actualizar' : 'Agregar'} Pregunta
              </button>
              {editingQuestion && (
                <button type="button" onClick={cancelEdit} className="btn btn-secondary">
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Preguntas Existentes:</h3>
            <div style={{ 
              background: 'rgba(0, 123, 255, 0.2)', 
              padding: '8px 15px', 
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              📊 Usadas: {usedQuestions.size}/{triviaQuestions.length}
              {usedQuestions.size === triviaQuestions.length && triviaQuestions.length > 0 && (
                <span style={{ marginLeft: '8px', color: '#28a745' }}>✅ Todas completadas</span>
              )}
            </div>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {triviaQuestions.map((question) => (
              <div 
                key={question.id} 
                className="trivia-item"
                style={{
                  opacity: usedQuestions.has(question.id) ? 0.7 : 1,
                  background: usedQuestions.has(question.id) ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255,255,255,0.05)',
                  border: usedQuestions.has(question.id) ? '2px solid rgba(40, 167, 69, 0.3)' : '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {usedQuestions.has(question.id) && (
                        <span style={{ 
                          background: '#28a745', 
                          color: 'white', 
                          padding: '2px 6px', 
                          borderRadius: '12px', 
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}>
                          ✅ USADA
                        </span>
                      )}
                      {question.question}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.8 }}>
                      Respuesta: {question.correctAnswer} | Puntos: {question.points} | Tipo: {question.type}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', marginLeft: '15px' }}>
                    {usedQuestions.has(question.id) ? (
                      <button
                        disabled
                        className="btn btn-secondary"
                        style={{ 
                          padding: '5px 10px', 
                          fontSize: '12px',
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        }}
                      >
                        ✅ Usada
                      </button>
                    ) : (
                      <button
                        onClick={() => startTriviaQuestion(question.id)}
                        className="btn btn-success"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        disabled={eventStatus.eventState === 'trivia-active'}
                      >
                        ▶️ Iniciar
                      </button>
                    )}
                    <button
                      onClick={() => editQuestion(question)}
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      disabled={usedQuestions.has(question.id)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => deleteQuestion(question.id)}
                      className="btn btn-danger"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      disabled={usedQuestions.has(question.id)}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controles del evento - Flujo estructurado */}
        <div className="admin-card">
          <h2>🎮 Controles del Evento - Flujo Estructurado</h2>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '10px' }}>📝 Flujo del Evento:</h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>1.</span> Realizar trivia (pregunta por pregunta) → Ver resultados de cada pregunta
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>2.</span> Finalizar trivia → Ver resultados finales y ranking
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>3.</span> Iniciar votación → Los invitados votan (pueden cambiar)
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>4.</span> Finalizar votación → Ver resultados de votación
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>5.</span> Cuenta regresiva → Preparar revelación
              </div>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: '600' }}>6.</span> Revelar género → ¡La gran revelación!
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>7.</span> Ganador → Premiar al más inteligente 🏆
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            
            {/* Paso 1: Trivia */}
            <div style={{ padding: '15px', background: 'rgba(0, 123, 255, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>🧠 1. Trivia</h4>
              
              {/* Información de trivia activa */}
              {eventStatus.eventState === 'trivia-active' && eventStatus.currentTrivia && (
                <div style={{ marginBottom: '15px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
                  <strong>Pregunta activa:</strong> {eventStatus.currentTrivia.question}<br />
                  <strong>Respuestas recibidas:</strong> {triviaResponses}/{eventStatus.guestCount || 0}
                </div>
              )}
              
              {/* Botón para mostrar resultados - solo habilitado cuando todos hayan respondido */}
              {eventStatus.eventState === 'trivia-active' && (
                <button 
                  onClick={showQuestionResults} 
                  className="btn btn-warning" 
                  disabled={!canShowResults()}
                  style={{ 
                    width: '100%', 
                    marginBottom: '10px', 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    opacity: canShowResults() ? 1 : 0.5,
                    cursor: canShowResults() ? 'pointer' : 'not-allowed'
                  }}
                >
                  {canShowResults() ? '📊 Mostrar Resultados de Esta Pregunta' : '⏳ Esperando que todos respondan...'}
                </button>
              )}
              
              {/* Indicador de progreso */}
              {eventStatus.eventState === 'trivia-active' && (
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  background: 'rgba(255,255,255,0.2)', 
                  borderRadius: '4px', 
                  marginBottom: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${eventStatus.guestCount > 0 ? (triviaResponses / eventStatus.guestCount) * 100 : 0}%`,
                    height: '100%',
                    background: canShowResults() ? 
                      'linear-gradient(90deg, #28a745, #20c997)' : 
                      'linear-gradient(90deg, #ffc107, #fd7e14)',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              )}
              
              {/* Estado actual */}
              <div style={{ fontSize: '12px', opacity: 0.8, textAlign: 'center', marginBottom: '10px' }}>
                <strong>Estado:</strong> {eventStatus.eventState || 'Cargando...'}
                {eventStatus.eventState === 'trivia-active' && (
                  <span style={{ 
                    display: 'block', 
                    marginTop: '5px',
                    color: canShowResults() ? '#28a745' : '#ffc107'
                  }}>
                    {canShowResults() ? 
                      '✅ Todos han respondido - Puedes mostrar resultados' : 
                      `⏳ Esperando ${(eventStatus.guestCount || 0) - (triviaResponses || 0)} respuesta(s) más`
                    }
                  </span>
                )}
              </div>
              
              <div style={{ fontSize: '12px', opacity: 0.8, textAlign: 'center' }}>
                {eventStatus.eventState === 'trivia-active' ? 
                  (canShowResults() ? 
                    'Todos los invitados han respondido' : 
                    'Trivia en progreso - Esperando respuestas') : 
                  'Selecciona una pregunta arriba para comenzar'
                }
              </div>
            </div>

            {/* Paso 2: Finalizar Trivia */}
            <div style={{ padding: '15px', background: 'rgba(40, 167, 69, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>🏆 2. Finalizar Trivia</h4>
              <button 
                onClick={endTrivia} 
                className="btn btn-success"
                style={{ width: '100%' }}
                disabled={eventStatus.eventState !== 'trivia-results' && eventStatus.eventState !== 'trivia-active'}
              >
                🏁 Mostrar Resultados Finales
              </button>
            </div>

            {/* Paso 3: Votación */}
            <div style={{ padding: '15px', background: 'rgba(255, 193, 7, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>🗳️ 3. Votación</h4>
              <button 
                onClick={startVoting} 
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '5px' }}
                disabled={eventStatus.eventState === 'voting-active' || eventStatus.eventState === 'voting-results'}
              >
                🗳️ Iniciar Votación
              </button>
              {eventStatus.eventState === 'voting-active' && (
                <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '5px' }}>
                  Votación en curso - Los invitados pueden cambiar su voto
                </div>
              )}
            </div>

            {/* Paso 4: Finalizar Votación */}
            <div style={{ padding: '15px', background: 'rgba(220, 53, 69, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>📊 4. Resultados Votación</h4>
              <button 
                onClick={endVoting} 
                className="btn btn-danger"
                style={{ width: '100%' }}
                disabled={eventStatus.eventState !== 'voting-active'}
              >
                📊 Finalizar y Mostrar Ganador
              </button>
            </div>

            {/* Paso 5: Cuenta Regresiva */}
            <div style={{ padding: '15px', background: 'rgba(108, 117, 125, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>⏰ 5. Cuenta Regresiva</h4>
              <button 
                onClick={startCountdown} 
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={eventStatus.eventState === 'countdown' || eventStatus.eventState === 'revealed'}
              >
                ⏰ Empezar Cuenta Regresiva
              </button>
            </div>

            {/* Paso 6: Revelación */}
            <div style={{ padding: '15px', background: 'rgba(255, 105, 180, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>🎊 6. Revelación</h4>
              <button 
                onClick={revealGender} 
                className="btn btn-success"
                style={{ width: '100%' }}
                disabled={!babyGender || eventStatus.eventState === 'revealed' || eventStatus.eventState === 'trivia-winner'}
              >
                🎊 Revelar Género
              </button>
              {!babyGender && (
                <div style={{ fontSize: '12px', color: '#ff6b6b', textAlign: 'center', marginTop: '5px' }}>
                  Configura el género primero
                </div>
              )}
            </div>

            {/* Paso 7: Ganador de Trivia */}
            <div style={{ padding: '15px', background: 'rgba(255, 215, 0, 0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>🏆 7. Ganador</h4>
              <button 
                onClick={showTriviaWinner} 
                className="btn btn-warning"
                style={{ width: '100%' }}
                disabled={eventStatus.eventState !== 'revealed'}
              >
                👑 Mostrar Ganador
              </button>
              <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '5px', opacity: 0.8 }}>
                {eventStatus.eventState !== 'revealed' ? 
                  'Primero revela el género' : 
                  'Mostrará al invitado con más puntos'
                }
              </div>
            </div>
          </div>

          {/* Botón de reinicio */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button onClick={resetEvent} className="btn btn-outline" style={{ padding: '10px 30px' }}>
              🔄 Reiniciar Evento Completo
            </button>
          </div>
        </div>

        {/* Lista de invitados */}
        <div className="admin-card">
          <h2>👥 Invitados Conectados ({guests.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {guests.map((guest) => (
              <div key={guest.id} style={{ 
                background: 'rgba(255,255,255,0.1)', 
                padding: '10px', 
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                {guest.name}
              </div>
            ))}
            {guests.length === 0 && (
              <div style={{ 
                gridColumn: '1 / -1', 
                textAlign: 'center', 
                opacity: 0.6,
                fontStyle: 'italic' 
              }}>
                No hay invitados conectados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;