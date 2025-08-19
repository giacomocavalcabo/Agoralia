import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon, 
  QuoteIcon, CodeIcon, LinkIcon, UndoIcon, RedoIcon 
} from '@heroicons/react/24/outline';

export default function RichTextEditor({ 
  value = '', 
  onChange, 
  placeholder = 'Inizia a scrivere...',
  disabled = false 
}) {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateContent();
  };

  const updateContent = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      execCommand('insertLineBreak');
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const insertLink = () => {
    const url = prompt('Inserisci URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const toolbarButtons = [
    { icon: BoldIcon, command: 'bold', label: 'Grassetto' },
    { icon: ItalicIcon, command: 'italic', label: 'Corsivo' },
    { icon: ListIcon, command: 'insertUnorderedList', label: 'Lista puntata' },
    { icon: ListOrderedIcon, command: 'insertOrderedList', label: 'Lista numerata' },
    { icon: QuoteIcon, command: 'formatBlock', value: 'blockquote', label: 'Citazione' },
    { icon: CodeIcon, command: 'formatBlock', value: 'pre', label: 'Codice' },
    { icon: LinkIcon, command: 'custom', action: insertLink, label: 'Link' }
  ];

  return (
    <div className={`border rounded-lg ${isFocused ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 rounded-t-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          disabled={!canUndo}
          title="Annulla"
        >
          <UndoIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          disabled={!canRedo}
          title="Ripeti"
        >
          <RedoIcon className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {toolbarButtons.map((button) => (
          <Button
            key={button.command}
            variant="ghost"
            size="sm"
            onClick={() => button.action ? button.action() : execCommand(button.command, button.value)}
            title={button.label}
          >
            <button.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className={`min-h-[200px] p-3 focus:outline-none ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
        }`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onInput={updateContent}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ 
          fontFamily: 'inherit',
          lineHeight: '1.6'
        }}
      />
      
      {!value && !isFocused && (
        <div className="absolute top-16 left-3 text-gray-400 pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
}
