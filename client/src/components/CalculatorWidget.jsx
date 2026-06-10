import { useState, useRef, useEffect } from 'react';
import './CalculatorWidget.css';

export default function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  
  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 280 : 0, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      // Keep it within bounds if window resizes, basic protection
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 260),
        y: Math.min(prev.y, window.innerHeight - 300)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    // Bound to screen
    const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 260));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 300));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  
  const handleDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else if (display === '0' || display === 'Error') {
      setDisplay(digit);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleOperator = (op) => {
    if (display === 'Error') return;
    
    if (waitingForOperand && equation !== '') {
      setEquation(equation.slice(0, -3) + ' ' + op + ' ');
      return;
    }

    setEquation(equation + display + ' ' + op + ' ');
    setWaitingForOperand(true);
  };

  const calculate = () => {
    try {
      if (!equation || waitingForOperand) return;
      // Using new Function instead of eval for a bit more safety, though it's evaluating math.
      const fullEq = equation + display;
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + fullEq)();
      const rounded = Math.round(result * 100) / 100;
      setDisplay(String(rounded));
      setEquation('');
      setWaitingForOperand(true);
    } catch (err) {
      setDisplay('Error');
      setEquation('');
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setWaitingForOperand(false);
  };

  const handleDel = () => {
    if (waitingForOperand) {
      setWaitingForOperand(false);
    }
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  return (
    <>
      <button
        type="button"
        className="calc-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Calculator"
        title="Calculator"
      >
        <span className="calc-toggle-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <line x1="8" y1="6" x2="16" y2="6"/>
            <line x1="16" y1="14" x2="16" y2="18"/>
            <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div 
          className="calc-widget glass"
          style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease' }}
        >
          <div 
            className="calc-drag-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to move"
          >
            <div className="calc-drag-indicator"></div>
          </div>
          <div className="calc-screen">
            <div className="calc-equation">{equation}</div>
            <div className="calc-display">{display}</div>
          </div>
          <div className="calc-pad">
            <button className="calc-btn calc-btn-act" onClick={clear}>C</button>
            <button className="calc-btn calc-btn-act" onClick={handleDel}>DEL</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOperator('/')}>/</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOperator('*')}>*</button>
            
            <button className="calc-btn" onClick={() => handleDigit('7')}>7</button>
            <button className="calc-btn" onClick={() => handleDigit('8')}>8</button>
            <button className="calc-btn" onClick={() => handleDigit('9')}>9</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOperator('-')}>-</button>
            
            <button className="calc-btn" onClick={() => handleDigit('4')}>4</button>
            <button className="calc-btn" onClick={() => handleDigit('5')}>5</button>
            <button className="calc-btn" onClick={() => handleDigit('6')}>6</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOperator('+')}>+</button>
            
            <button className="calc-btn" onClick={() => handleDigit('1')}>1</button>
            <button className="calc-btn" onClick={() => handleDigit('2')}>2</button>
            <button className="calc-btn" onClick={() => handleDigit('3')}>3</button>
            <button className="calc-btn calc-btn-eq" onClick={calculate}>=</button>
            
            <button className="calc-btn calc-btn-zero" onClick={() => handleDigit('0')}>0</button>
            <button className="calc-btn" onClick={() => handleDigit('.')}>.</button>
          </div>
        </div>
      )}
    </>
  );
}
