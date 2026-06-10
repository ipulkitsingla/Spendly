import { useState } from 'react';
import './CalculatorWidget.css';

export default function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  
  const handleDigit = (digit) => {
    if (display === '0' || display === 'Error') {
      setDisplay(digit);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleOperator = (op) => {
    if (display === 'Error') return;
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      if (!equation) return;
      // Using new Function instead of eval for a bit more safety, though it's evaluating math.
      const fullEq = equation + display;
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + fullEq)();
      const rounded = Math.round(result * 100) / 100;
      setDisplay(String(rounded));
      setEquation('');
    } catch (err) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleDel = () => {
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
        <div className="calc-widget glass">
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
