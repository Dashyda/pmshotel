const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes unsafe HTML characters to protect print/export templates.
 * Accepts strings, numbers, booleans, and nullish values.
 */
export const escapeHTML = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (!stringValue) {
    return '';
  }

  return stringValue.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
};
