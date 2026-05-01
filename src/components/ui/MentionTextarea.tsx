import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';

interface User {
  id: number;
  name: string;
  username: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MentionTextarea({ value, onChange, placeholder, className }: MentionTextareaProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await apiFetch<User[]>('/api/users');
        setUsers(data);
      } catch (e) {}
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(filter.toLowerCase()) || 
    u.username.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 8);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showPopup) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectUser(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowPopup(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart;
    const textBefore = newVal.slice(0, cursor);
    const mentionMatch = textBefore.match(/@(\w*)$/);

    if (mentionMatch) {
      const rect = e.target.getBoundingClientRect();
      // Very rough estimate of cursor position for popup
      const lines = textBefore.split('\n');
      const lastLine = lines[lines.length - 1];
      setPopupPos({ 
        top: e.target.offsetTop + (lines.length * 20) + 10, 
        left: e.target.offsetLeft + (lastLine.length * 8) + 20 
      });
      setShowPopup(true);
      setFilter(mentionMatch[1]);
      setSelectedIndex(0);
    } else {
      setShowPopup(false);
    }
    onChange(newVal);
  };

  const selectUser = (user: User) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, cursor);
    const textAfter = value.slice(cursor);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const prefix = textBefore.slice(0, mentionMatch.index);
      const inserted = `${prefix}@${user.name} `;
      onChange(inserted + textAfter);
      setShowPopup(false);
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursor = inserted.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showPopup && filteredUsers.length > 0 && (
        <div 
          className="absolute z-[200] w-48 bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ top: popupPos.top, left: Math.min(popupPos.left, 200) }}
        >
          <div className="p-2 bg-slate-50 dark:bg-navy-950 border-b border-slate-100 dark:border-navy-800 text-[9px] font-bold text-slate-400 tracking-tight">选择要提及的同事</div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filteredUsers.map((user, i) => (
              <div
                key={user.id}
                onClick={() => selectUser(user)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${i === selectedIndex ? 'bg-primary-navy/5 dark:bg-tertiary-sage/5 text-primary-navy dark:text-tertiary-sage font-bold' : 'text-slate-600 dark:text-slate-300'}`}
              >
                <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-navy-900 flex items-center justify-center text-[10px] font-bold border border-slate-200 dark:border-navy-700">{user.name.charAt(0)}</div>
                <div className="text-xs truncate">{user.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
