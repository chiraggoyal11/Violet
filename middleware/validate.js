function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const v = req.body?.[f];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (missing.length) {
      return res.status(400).json({
        success: false,
        msg: `Missing required fields: ${missing.join(', ')}`
      });
    }
    return next();
  };
}

function parsePrice(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function isValidPrice(value) {
  const n = parsePrice(value);
  return Number.isFinite(n) && n >= 0;
}

module.exports = {
  requireFields,
  parsePrice,
  isValidPrice
};
