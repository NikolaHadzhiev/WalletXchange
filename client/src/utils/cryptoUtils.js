import CryptoJS from 'crypto-js';

// Enhanced encryption functions
export const encryptData = (data) => {
  try {
    const key = import.meta.env.VITE_STATE_ENCRYPTION_KEY || 'temp-fallback-key';
    const saltedData = {
      data,
      salt: CryptoJS.lib.WordArray.random(128/8).toString(),
      timestamp: Date.now()
    };
    const hmac = CryptoJS.HmacSHA256(JSON.stringify(saltedData), key).toString();
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify({...saltedData, hmac}), key).toString();
    return encodeURIComponent(encryptedData);
  } catch (error) {
    return null;
  }
};

export const decryptData = (ciphertext) => {
  try {
    const key = import.meta.env.VITE_STATE_ENCRYPTION_KEY || 'temp-fallback-key';
    const decrypted = CryptoJS.AES.decrypt(decodeURIComponent(ciphertext), key).toString(CryptoJS.enc.Utf8);
    const data = JSON.parse(decrypted);
    const { hmac, ...payloadWithoutHmac } = data;
    const computedHmac = CryptoJS.HmacSHA256(JSON.stringify(payloadWithoutHmac), key).toString();
    
    if (computedHmac !== hmac) {
      return null;
    }
    
    if (Date.now() - payloadWithoutHmac.timestamp > 3600000) {
      return null;
    }
    
    return payloadWithoutHmac.data;
  } catch (error) {
    return null;
  }
};
