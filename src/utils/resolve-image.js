/**
 * Ex:
 * - "/api/media/https%3A/qpay.mn/q/logo/khanbank.png" → "https://qpay.mn/q/logo/khanbank.png"
 * - "/api/media/qpay.mn/q/logo/khanbank.png" → "https://qpay.mn/q/logo/khanbank.png"
 */
export function resolveImage(url) {
  if (!url || typeof url !== 'string') return url;
  
  const prefix = '/api/media/';
  if (url.startsWith(prefix)) {
    try {
      let pathPart = url.slice(prefix.length);
      let decoded = decodeURIComponent(pathPart);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('resolveImage debug:', { original: url, pathPart, decoded });
      }
      
      if (decoded.startsWith('https:/') && !decoded.startsWith('https://')) {
        decoded = decoded.replace('https:/', 'https://');
      } else if (decoded.startsWith('http:/') && !decoded.startsWith('http://')) {
        decoded = decoded.replace('http:/', 'http://');
      } else if (decoded.match(/^https?[^:\/]/)) {
        decoded = decoded.replace(/^(https?)([^:\/])/, '$1://$2');
      }
      
      if (!decoded.startsWith('http') && decoded.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
        decoded = 'https://' + decoded;
      }
      
      if (decoded.match(/^https?:\/\/.+\..+/)) {
        return decoded;
      }
      
      console.warn('resolveImage: Could not create valid URL from:', { original: url, decoded });
    } catch (error) {
      console.error('resolveImage: Error decoding URL:', { url, error });
    }
  }
  
  return url;
}