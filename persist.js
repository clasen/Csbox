import Deepbase from 'deepbase';
import CryptoJS from 'crypto-js';

class Persist extends Deepbase {
    constructor(opts) {
        opts.name = opts.name || 'persist';
        opts.stringify = (obj) => Persist.encrypt(obj, opts.encryptionKey);
        opts.parse = (encryptedData) => Persist.decrypt(encryptedData, opts.encryptionKey);
        super(opts);
    }

    static encrypt(obj, encryptionKey) {
        const iv = CryptoJS.lib.WordArray.random(128 / 8);
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(obj), encryptionKey, { iv });
        return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
    }

    static decrypt(encryptedData, encryptionKey) {
        try {
            const [ivHex, encrypted] = encryptedData.split(':');
            const iv = CryptoJS.enc.Hex.parse(ivHex);
            const bytes = CryptoJS.AES.decrypt(encrypted, encryptionKey, { iv });
            const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
            
            // If decryption with wrong password, the result will be empty or invalid
            if (!decryptedStr) {
                throw new Error('INVALID_PASSWORD');
            }
            
            return JSON.parse(decryptedStr);
        } catch (err) {
            // If it's a UTF-8 or JSON parse error, it means wrong password
            if (err.message === 'INVALID_PASSWORD' || err.message.includes('Malformed UTF-8') || err instanceof SyntaxError) {
                throw new Error('INVALID_PASSWORD');
            }
            throw err;
        }
    }
}

export default Persist;