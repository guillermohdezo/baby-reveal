import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import AdminLogin from './AdminLogin';

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [socket, setSocket] = useState(null);
  const [triviaQuestions, setTriviaQuestions] = useState([]);
  const [guests, setGuests] = useState([]);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    correctAnswer: '',
    points: 10,
    type: 'text',
    options: ['', '', '', '']
  });
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [babyGender, setBabyGender] = useState('');
  const [genderMessage, setGenderMessage] = useState('');
  const [eventStatus, setEventStatus] = useState({});
  // Popup para confirmar revelación de género
  const [showGenderPopup, setShowGenderPopup] = useState(false);
  const [triviaResponses, setTriviaResponses] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState(new Set());
  const [drawingPrompts, setDrawingPrompts] = useState([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [drawingDuration, setDrawingDuration] = useState(120);

  const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

  // Verificar autenticación al cargar
  useEffect(() => {
    const savedPassword = localStorage.getItem('adminPassword');
    console.log('Contraseña guardada encontrada:', savedPassword ? 'presente' : 'ausente');
    if (savedPassword) {
      setAdminPassword(savedPassword);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !adminPassword) return;
    
    const newSocket = io(API_BASE);
    setSocket(newSocket);

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
  }, [isAuthenticated, adminPassword]);

  // Actualizar estado cada 2 segundos para mantener información actualizada
  useEffect(() => {
    if (!isAuthenticated || !adminPassword) return;
    
    const interval = setInterval(async () => {
      if (!adminPassword) return;
      try {
        const response = await axios({
          method: 'get',
          url: `${API_BASE}/api/status`,
          headers: {
            'x-admin-password': adminPassword
          }
        });
        setEventStatus(response.data);
      } catch (error) {
        console.error('Error cargando estado en intervalo:', error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, adminPassword, API_BASE]);

  // Helper para hacer peticiones autenticadas
  const authenticatedRequest = useCallback((config) => {
    return {
      ...config,
      headers: {
        ...config.headers,
        'x-admin-password': adminPassword
      }
    };
  }, [adminPassword]);

  const handleLogin = (password) => {
    console.log('handleLogin llamado con contraseña:', password ? 'presente' : 'ausente');
    localStorage.setItem('adminPassword', password);
    setAdminPassword(password);
    setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminPassword');
    setIsAuthenticated(false);
    setAdminPassword('');
  }, []);

  const loadTriviaQuestions = useCallback(async () => {
    console.log('loadTriviaQuestions llamado, adminPassword:', adminPassword ? 'presente' : 'ausente');
    if (!adminPassword) return;
    try {
      const response = await axios(authenticatedRequest({
        method: 'get',
        url: `${API_BASE}/api/trivia`
      }));
      console.log('Preguntas cargadas exitosamente:', response.data.length);
      setTriviaQuestions(response.data);
    } catch (error) {
      console.error('Error cargando preguntas:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [adminPassword, API_BASE, authenticatedRequest, handleLogout]);

  const loadGender = useCallback(async () => {
    if (!adminPassword) return;
    try {
      const response = await axios(authenticatedRequest({
        method: 'get',
        url: `${API_BASE}/api/gender`
      }));
      setBabyGender(response.data.gender || '');
    } catch (error) {
      console.error('Error cargando género:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [adminPassword, API_BASE, authenticatedRequest, handleLogout]);

  const loadStatus = useCallback(async () => {
    console.log('loadStatus llamado, adminPassword:', adminPassword ? 'presente' : 'ausente');
    if (!adminPassword) return;
    try {
      const response = await axios(authenticatedRequest({
        method: 'get',
        url: `${API_BASE}/api/status`
      }));
      console.log('Estado cargado exitosamente:', response.data);
      setEventStatus(response.data);
    } catch (error) {
      console.error('Error cargando estado:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [adminPassword, API_BASE, authenticatedRequest, handleLogout]);

  // Función para cargar prompts de dibujo
  const loadDrawingPrompts = useCallback(async () => {
    if (!adminPassword) return;
    try {
      const response = await axios({
        method: 'get',
        url: `${API_BASE}/api/drawing-prompts`,
        headers: {
          'x-admin-password': adminPassword
        }
      });
      setDrawingPrompts(response.data);
    } catch (error) {
      console.error('Error cargando prompts:', error);
    }
  }, [adminPassword]);

  // Cargar datos iniciales cuando esté autenticado
  useEffect(() => {
    if (!isAuthenticated || !adminPassword) return;
    
    loadTriviaQuestions();
    loadGender();
    loadStatus();
    loadDrawingPrompts();
  }, [isAuthenticated, adminPassword, loadTriviaQuestions, loadGender, loadStatus, loadDrawingPrompts]);

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
        type: 'text',
        options: ['', '', '', '']
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
      type: question.type,
      options: question.options || ['', '', '', '']
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

  const handleGenderSelect = async (gender) => {
    setBabyGender(gender);
    
    try {
      await axios({
        method: 'post',
        url: `${API_BASE}/api/gender`,
        data: { gender },
        headers: {
          'x-admin-password': adminPassword
        }
      });
      const genderText = gender === 'boy' ? 'Niño 👦' : 'Niña 👧';
      setGenderMessage(`✓ Género cambiado a ${genderText}`);
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setGenderMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error guardando género:', error);
      setGenderMessage('❌ Error al guardar el género');
      
      setTimeout(() => {
        setGenderMessage('');
      }, 3000);
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

  // Funciones para prompts de dibujo

  const addDrawingPrompt = async () => {
    if (!newPrompt.trim()) return;
    try {
      await axios({
        method: 'post',
        url: `${API_BASE}/api/drawing-prompts`,
        data: { prompt: newPrompt },
        headers: {
          'x-admin-password': adminPassword
        }
      });
      setNewPrompt('');
      loadDrawingPrompts();
    } catch (error) {
      console.error('Error agregando prompt:', error);
    }
  };

  const deleteDrawingPrompt = async (promptId) => {
    try {
      await axios({
        method: 'delete',
        url: `${API_BASE}/api/drawing-prompts/${promptId}`,
        headers: {
          'x-admin-password': adminPassword
        }
      });
      loadDrawingPrompts();
    } catch (error) {
      console.error('Error eliminando prompt:', error);
    }
  };

  const startDrawingGame = (promptId) => {
    if (socket) {
      socket.emit('admin-start-drawing-game', {
        promptId,
        duration: drawingDuration
      });
    }
  };

  const showDrawingResults = () => {
    if (socket) {
      socket.emit('admin-show-drawing-results');
    }
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
    if (babyGender) {
      setShowGenderPopup(true);
    }
  };

  const handleConfirmRevealGender = () => {
    if (socket && babyGender) {
      setShowGenderPopup(false);
      socket.emit('admin-reveal-gender');
    }
  };

  const handleCancelRevealGender = () => {
    setShowGenderPopup(false);
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
      type: 'text',
      options: ['', '', '', '']
    });
  };

  const adminContent = (
    <div className="admin-panel">
      <div className="container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px' 
        }}>
          <h1 style={{ color: 'white', margin: 0 }}>
            🎛️ Panel de Administración
          </h1>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '14px',
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.3)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.2)';
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>

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

          {/* Minijuego de Dibujo */}
          <div className="admin-card">
            <h2>🎨 Minijuego de Dibujo</h2>
            
            {/* Agregar nuevo prompt */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label">Agregar tema para dibujar:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Ej: Dibuja un bebé, Una cuna, etc."
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={addDrawingPrompt}
                  className="btn btn-primary"
                  disabled={!newPrompt.trim()}
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Configuración de duración */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label">Duración del dibujo (segundos):</label>
              <select
                className="form-input"
                value={drawingDuration}
                onChange={(e) => setDrawingDuration(parseInt(e.target.value))}
                style={{ marginTop: '10px' }}
              >
                <option value={60}>1 minuto</option>
                <option value={90}>1.5 minutos</option>
                <option value={120}>2 minutos</option>
                <option value={180}>3 minutos</option>
                <option value={300}>5 minutos</option>
              </select>
            </div>

            {/* Lista de prompts */}
            <div>
              <h3 style={{ marginBottom: '15px' }}>Temas disponibles:</h3>
              {drawingPrompts.length === 0 ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: 'rgba(255,255,255,0.6)',
                  fontStyle: 'italic' 
                }}>
                  No hay temas agregados. Agrega algunos temas para que los invitados dibujen.
                </div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {drawingPrompts.map((prompt) => (
                    <div 
                      key={prompt.id}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '5px' }}>
                          🎨 {prompt.prompt}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                          Creado: {new Date(prompt.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => startDrawingGame(prompt.id)}
                          className="btn btn-success"
                          style={{ padding: '8px 15px', fontSize: '14px' }}
                          disabled={eventStatus.eventState === 'drawing-active' || eventStatus.eventState === 'drawing-voting'}
                        >
                          🚀 Iniciar
                        </button>
                        <button
                          onClick={() => deleteDrawingPrompt(prompt.id)}
                          className="btn btn-danger"
                          style={{ padding: '8px 12px', fontSize: '14px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Controles durante el juego */}
            {(eventStatus.eventState === 'drawing-active' || eventStatus.eventState === 'drawing-voting') && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                background: 'rgba(0, 123, 255, 0.1)',
                border: '2px solid rgba(0, 123, 255, 0.3)',
                borderRadius: '8px'
              }}>
                {eventStatus.eventState === 'drawing-active' && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      🎨 Minijuego en curso
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>
                      Los invitados están dibujando. La votación comenzará automáticamente.
                    </div>
                  </div>
                )}
                {eventStatus.eventState === 'drawing-voting' && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                      🗳️ Fase de votación
                    </div>
                    <button
                      onClick={showDrawingResults}
                      className="btn btn-primary"
                      style={{ padding: '10px 20px' }}
                    >
                      📊 Mostrar Resultados
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Configuración del género */}
          <div className="admin-card">
            <h2>👶 Configuración del Bebé</h2>
            
            {/* Mensaje de confirmación */}
            {genderMessage && (
              <div style={{
                background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                {genderMessage}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Selecciona el género del bebé:</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px',
                marginTop: '15px'
              }}>
                <button
                  onClick={() => handleGenderSelect('boy')}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: '3px solid ' + (babyGender === 'boy' ? '#74b9ff' : 'rgba(255,255,255,0.2)'),
                    background: babyGender === 'boy' 
                      ? 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
                      : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: babyGender === 'boy' ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: babyGender === 'boy' ? '0 8px 25px rgba(116, 185, 255, 0.3)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (babyGender !== 'boy') {
                      e.target.style.background = 'rgba(116, 185, 255, 0.2)';
                      e.target.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (babyGender !== 'boy') {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
                >
                  👦<br />
                  <span style={{ fontSize: '16px' }}>Niño</span>
                  {babyGender === 'boy' && (
                    <div style={{ marginTop: '8px', fontSize: '14px', opacity: '0.9' }}>
                      ✓ Seleccionado
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => handleGenderSelect('girl')}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: '3px solid ' + (babyGender === 'girl' ? '#fd79a8' : 'rgba(255,255,255,0.2)'),
                    background: babyGender === 'girl'
                      ? 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)'
                      : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: babyGender === 'girl' ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: babyGender === 'girl' ? '0 8px 25px rgba(253, 121, 168, 0.3)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (babyGender !== 'girl') {
                      e.target.style.background = 'rgba(253, 121, 168, 0.2)';
                      e.target.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (babyGender !== 'girl') {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
                >
                  👧<br />
                  <span style={{ fontSize: '16px' }}>Niña</span>
                  {babyGender === 'girl' && (
                    <div style={{ marginTop: '8px', fontSize: '14px', opacity: '0.9' }}>
                      ✓ Seleccionada
                    </div>
                  )}
                </button>
              </div>
            </div>
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
                <label className="form-label">Tipo de pregunta:</label>
                <select
                  className="form-input"
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion({
                    ...newQuestion, 
                    type: e.target.value,
                    options: e.target.value === 'multiple-choice' ? ['', '', '', ''] : newQuestion.options,
                    correctAnswer: e.target.value === 'multiple-choice' ? 'A' : ''
                  })}
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="email">Email</option>
                  <option value="date">Fecha</option>
                  <option value="multiple-choice">Opción Múltiple</option>
                </select>
              </div>
            </div>

            {/* Opciones múltiples */}
            {newQuestion.type === 'multiple-choice' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Opciones de respuesta:</label>
                {newQuestion.options.map((option, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                    <span style={{ minWidth: '30px', fontWeight: 'bold' }}>
                      {String.fromCharCode(65 + index)}:
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      value={option}
                      onChange={(e) => {
                        const updatedOptions = [...newQuestion.options];
                        updatedOptions[index] = e.target.value;
                        setNewQuestion({...newQuestion, options: updatedOptions});
                      }}
                      placeholder={`Texto de la opción ${String.fromCharCode(65 + index)}`}
                      required
                    />
                    <input
                      type="radio"
                      name="correctOption"
                      checked={newQuestion.correctAnswer === String.fromCharCode(65 + index)}
                      onChange={() => setNewQuestion({
                        ...newQuestion, 
                        correctAnswer: String.fromCharCode(65 + index)
                      })}
                      style={{ marginLeft: '10px' }}
                    />
                    <label style={{ fontSize: '14px', color: 'white' }}>Correcta</label>
                  </div>
                ))}
              </div>
            )}

            {/* Respuesta para otros tipos */}
            {newQuestion.type !== 'multiple-choice' && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Respuesta correcta:</label>
                <input
                  type="text"
                  className="form-input"
                  value={newQuestion.correctAnswer}
                  onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})}
                  required
                />
              </div>
            )}
            
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

            {/* Popup de confirmación para revelar género */}
            {showGenderPopup && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
              }}>
                <div style={{
                  background: '#23272f',
                  borderRadius: '16px',
                  padding: '32px 24px',
                  minWidth: '320px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  textAlign: 'center',
                  position: 'relative',
                  color: '#222'
                }}>
                  <h2 style={{ color: '#fff', background: babyGender === 'boy' ? '#0984e3' : '#fd79a8', borderRadius: 8, padding: '8px 0', marginBottom: 16, fontWeight: 700, letterSpacing: 1 }}>¿Revelar Género?</h2>
                  <div style={{ fontSize: 20, marginBottom: 24, color: '#f5f6fa' }}>
                    Se mostrará: <b style={{ color: babyGender === 'boy' ? '#74b9ff' : '#ffb6c1', fontSize: 24 }}>{babyGender === 'boy' ? 'NIÑO' : babyGender === 'girl' ? 'NIÑA' : babyGender}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                    <button className="btn btn-light" style={{ color: '#d63031', fontWeight: 600, background: '#fff', border: '1px solid #dfe6e9' }} onClick={handleCancelRevealGender}>Cancelar</button>
                    <button className="btn btn-success" style={{ fontWeight: 600, background: babyGender === 'boy' ? '#0984e3' : '#fd79a8', border: 'none', color: '#fff' }} onClick={handleConfirmRevealGender}>Revelar</button>
                  </div>
                </div>
              </div>
            )}

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

  // Mostrar pantalla de login si no está autenticado
  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return adminContent;
};

export default AdminPanel;