import React from 'react';
import Spreadsheet from './Spreadsheet';
import { AuthProvider } from './AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Spreadsheet />
      </div>
    </AuthProvider>
  );
}

export default App;
