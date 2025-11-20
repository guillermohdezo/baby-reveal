# 🎉 Aplicación de Revelación de Sexo Interactiva

Una aplicación web completa para hacer revelaciones de sexo del bebé súper interactivas y divertidas, con trivia en tiempo real, chat en vivo, votación final y efectos dramáticos.

## 🚀 Características

### 👥 Para los Invitados
- **Registro sencillo**: Solo nombre y listo
- **Chat en tiempo real**: Conversaciones durante todo el evento
- **Reacciones con emojis**: Que aparecen volando en la pantalla de proyección
- **Trivia interactiva**: Preguntas personalizadas con puntuación
- **Votación final**: Círculos que crecen según los votos
- **Experiencia dramática**: Cuenta regresiva y revelación con efectos

### 🎛️ Para el Administrador
- **Panel de control completo**: Gestión total del evento
- **Editor de trivia**: Crear, editar y eliminar preguntas
- **Control del flujo**: Iniciar trivias, votaciones y revelación
- **Monitoreo en tiempo real**: Ver invitados conectados y respuestas
- **Configuración del género**: Establecer el resultado de la revelación

### 🖥️ Pantalla de Proyección
- **Vista para proyector/TV**: Diseñada para mostrar en pantalla grande
- **Efectos visuales**: Transiciones suaves y animaciones
- **Emojis flotantes**: Las reacciones de los invitados aparecen volando
- **Votación visual**: Círculos que crecen con los votos y nombres de los votantes
- **Cuenta regresiva dramática**: Con efectos de sonido y visuales
- **Confetti digital**: Celebración automática en la revelación

## 📋 Instalación y Uso

### 1. Instalar dependencias del servidor
```bash
cd baby-reveal-app
npm install
```

### 2. Instalar dependencias del cliente
```bash
cd client
npm install
```

### 3. Construir el cliente (opcional, para producción)
```bash
cd client
npm run build
```

### 4. Iniciar el servidor
```bash
# Desde la carpeta baby-reveal-app
npm start
# o para desarrollo con auto-restart:
npm run dev
```

## 🌐 URLs de la Aplicación

Una vez que el servidor esté ejecutándose:

- **Invitados**: `http://localhost:3001/`
- **Panel de Admin**: `http://localhost:3001/admin`
- **Pantalla de Proyección**: `http://localhost:3001/projection`

## 📱 Cómo Usar Durante el Evento

### Preparación (Admin)
1. Ir a `/admin`
2. **Configurar el género del bebé** (¡No se lo digas a nadie!)
3. **Crear preguntas de trivia** personalizadas
4. **Abrir la pantalla de proyección** en una TV/proyector (`/projection`)

### Durante el Evento

#### 1. **Registro de Invitados**
- Los invitados entran a la URL principal
- Se registran con su nombre
- ¡Ya pueden participar!

#### 2. **Actividades Interactivas**
- **Chat en vivo**: Los mensajes aparecen en la pantalla de proyección
- **Reacciones**: Los emojis vuelan por la pantalla grande
- **Trivia**: El admin lanza preguntas y ve las respuestas en tiempo real

#### 3. **Votación Final**
- El admin inicia la votación
- Los invitados votan "Niño" o "Niña"
- Los círculos en la pantalla crecen según los votos
- Los nombres de los votantes aparecen como burbujas

#### 4. **Revelación Dramática**
- Cuenta regresiva de 5 segundos con efectos
- ¡Revelación del género con confetti digital!
- Celebración automática

## 🎮 Controles del Administrador

### Panel de Trivia
- **Crear preguntas**: Con respuesta correcta, puntos y tipo de input
- **Editar preguntas**: Modificar preguntas existentes
- **Iniciar trivia**: Enviar pregunta a todos los invitados
- **Ver respuestas**: Monitor en tiempo real de quién responde

### Control del Evento
- **Iniciar Votación**: Comenzar la votación final
- **Cuenta Regresiva**: Crear suspenso antes de la revelación
- **Revelar Género**: ¡El momento culminante!

### Monitoreo
- **Ver invitados conectados**: Lista en tiempo real
- **Estado del evento**: Qué está pasando ahora
- **Respuestas de trivia**: Cuántas respuestas se han recibido

## 🛠️ Personalización

### Agregar Más Emojis
Edita el array `emojis` en `GuestInterface.js`:
```javascript
const emojis = ['😍', '🥰', '😂', '🤗', '😮', '🎉', '💕', '👶', '🍼', '🎈'];
```

### Cambiar Colores del Tema
Los colores están definidos en `index.css` con CSS custom properties.

### Modificar Tiempos
- **Cuenta regresiva**: Cambiar el valor inicial en `ProjectionScreen.js`
- **Duración del confetti**: Modificar el timeout en el mismo archivo

## 📱 Compatibilidad

- ✅ **Dispositivos móviles**: Diseño responsivo
- ✅ **Tablets y laptops**: Interfaz adaptable
- ✅ **Navegadores modernos**: Chrome, Firefox, Safari, Edge
- ✅ **Proyectores/TVs**: Pantalla de proyección optimizada

## 🎯 Casos de Uso

### 🏠 **En Casa**
- Baby shower familiar
- Reunión íntima de amigos
- Evento virtual por videollamada

### 🎪 **Eventos Grandes**
- Salón de fiestas
- Restaurante privado
- Parque o jardín con proyector

### 💻 **Híbrido/Virtual**
- Algunos presentes, otros por Zoom
- Compartir pantalla de proyección
- Chat sincronizado

## 🔧 Solución de Problemas

### Los invitados no se conectan
- Verificar que el servidor esté ejecutándose
- Confirmar que todos estén en la misma red WiFi
- Revisar que no haya firewall bloqueando el puerto 3001

### La pantalla de proyección no se actualiza
- Refrescar la página `/projection`
- Verificar conexión a internet
- Revisar la consola del navegador por errores

### Las trivias no aparecen
- Confirmar que haya preguntas creadas en el admin
- Verificar que el admin haya clickeado "Iniciar" en la pregunta

## 🎊 ¡Disfruta tu Revelación!

Esta aplicación está diseñada para hacer tu revelación de sexo súper especial y memorable. ¡Todos los invitados van a querer participar y van a recordar este momento para siempre!

### 💡 Tips Extra
- 📸 **Graba la pantalla** durante la revelación para tener el video completo
- 🎵 **Agrega música** de fondo para más ambiente
- 📱 **Designa un "DJ de emojis"** para animar a los tímidos
- 🏆 **Premia al ganador** de la trivia con algo simbólico

---

¿Necesitas ayuda o quieres agregar más funciones? ¡No dudes en preguntar! 🚀