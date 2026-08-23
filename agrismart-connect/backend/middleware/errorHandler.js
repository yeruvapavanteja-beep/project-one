// ============================================================
// Centralized error handler
// Never leaks stack traces or DB details to the client.
// ============================================================
function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Multer file size / type errors
  if (err.name === 'MulterError' || /image files are allowed/.test(err.message)) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists.' });
  }

  // JSON parse errors from bad request bodies
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Something went wrong on our end. Please try again.' : err.message
  });
}

module.exports = { notFound, errorHandler };
