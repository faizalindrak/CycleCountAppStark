import React from 'react';
import { Delete, Divide, Minus, Plus, X } from 'lucide-react';

const Calculator = ({ value, onChange, onClose }) => {
  const handleButtonClick = (buttonValue) => {
    if (buttonValue === 'clear') {
      onChange('');
    } else if (buttonValue === 'backspace') {
      onChange(value.slice(0, -1));
    } else {
      onChange(value + buttonValue);
    }
  };

  const buttons = [
    ['7', '8', '9', 'backspace'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '-'],
    ['0', '.', '*', '/'],
    ['clear']
  ];

  const getButtonIcon = (buttonValue) => {
    switch (buttonValue) {
      case 'backspace':
        return <Delete className="h-4 w-4" />;
      case '+':
        return <Plus className="h-4 w-4" />;
      case '-':
        return <Minus className="h-4 w-4" />;
      case '*':
        return <X className="h-4 w-4" />;
      case '/':
        return <Divide className="h-4 w-4" />;
      default:
        return buttonValue;
    }
  };

  const getButtonClass = (buttonValue) => {
    const baseClass = "p-3 m-1 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500";

    if (buttonValue === 'clear') {
      return `${baseClass} bg-red-500 text-white hover:bg-red-600 col-span-4`;
    }

    if (['+', '-', '*', '/'].includes(buttonValue)) {
      return `${baseClass} bg-blue-500 text-white hover:bg-blue-600`;
    }

    if (buttonValue === 'backspace') {
      return `${baseClass} bg-orange-500 text-white hover:bg-orange-600`;
    }

    return `${baseClass} bg-gray-200 text-gray-800 hover:bg-gray-300`;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Calculator</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-gray-100 p-3 rounded-md min-h-[40px] text-right">
          <span className="text-lg font-mono">{value || '0'}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {buttons.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((buttonValue, buttonIndex) => (
              <button
                key={buttonIndex}
                onClick={() => handleButtonClick(buttonValue)}
                className={getButtonClass(buttonValue)}
                title={
                  buttonValue === 'backspace' ? 'Backspace' :
                  buttonValue === 'clear' ? 'Clear' :
                  buttonValue
                }
              >
                {getButtonIcon(buttonValue)}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Use calculator or type expressions like: 5*10+5*20
      </div>
    </div>
  );
};

export default Calculator;