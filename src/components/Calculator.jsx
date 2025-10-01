import React from 'react';
import { Delete, Divide, Minus, Plus, X } from 'lucide-react';

const Calculator = ({ value, onChange }) => {
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
    const baseClass = "p-3 m-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500";

    if (buttonValue === 'clear') {
      return `${baseClass} bg-red-500 text-white hover:bg-red-600 col-span-4 font-bold text-lg`;
    }

    if (['+', '-', '*', '/'].includes(buttonValue)) {
      return `${baseClass} bg-blue-500 text-white hover:bg-blue-600 font-bold text-xl`;
    }

    if (buttonValue === 'backspace') {
      return `${baseClass} bg-orange-500 text-white hover:bg-orange-600 font-bold text-lg`;
    }

    return `${baseClass} bg-gray-200 text-gray-800 hover:bg-gray-300 font-bold text-lg`;
  };

  return (
    <div className="p-1">
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
    </div>
  );
};

export default Calculator;