import { parseSseLine } from "./stream";

// Jest unit tests
describe('parseSseLine', () => {
    it('should return done:true and data:undefined for line starting with "data:[DONE]"', () => {
      const result = parseSseLine('data:[DONE]');
      expect(result).toEqual({ done: true, data: undefined });
    });

    it('should return done:true and data:undefined for line starting with "data: [DONE]"', () => {
      const result = parseSseLine('data: [DONE]');
      expect(result).toEqual({ done: true, data: undefined });
    });

    it('should return done:false and parsed data for line starting with "data:"', () => {
      const result = parseSseLine('data:Hello World');
      expect(result).toEqual({ done: false, data: 'Hello World' });
    });

    it('should return done:true and data:undefined for line starting with ": ping"', () => {
      const result = parseSseLine(': ping');
      expect(result).toEqual({ done: true, data: undefined });
    });

    it('should return done:false and data:undefined for line not starting with specific prefixes', () => {
      const result = parseSseLine('random line');
      expect(result).toEqual({ done: false, data: undefined });
    });
  });