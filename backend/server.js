require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectCentralDb = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// In development Vite picks whichever port is free (5173, 5174, …) depending
// on what else is running, so any localhost origin is allowed. Outside
// development only CLIENT_ORIGIN is.
const isLocalhost = (origin) => /^http:\/\/localhost:\d+$/.test(origin);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        origin === process.env.CLIENT_ORIGIN ||
        (process.env.NODE_ENV === 'development' && isLocalhost(origin));
      callback(null, allowed);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ success: true, data: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectCentralDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[server] failed to connect to central DB, aborting startup:', err.message);
    process.exit(1);
  });

module.exports = app;
