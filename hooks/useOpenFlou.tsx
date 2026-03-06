// Openflou Hook - Access Global Context
import { useContext } from 'react';
import { OpenFlouContext } from '@/contexts/OpenFlouContext';

export function useOpenFlou() {
  const context = useContext(OpenFlouContext);
  if (!context) {
    throw new Error('useOpenFlou must be used within OpenFlouProvider');
  }
  return context;
}
