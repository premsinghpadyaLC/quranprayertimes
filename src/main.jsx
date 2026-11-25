import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('QFE – Prem render error:', error, info); }
  render() {
    if (this.state.error) {
      return <main style={{maxWidth:680,margin:'60px auto',padding:24,fontFamily:'Arial,sans-serif',color:'#1a2a40'}}>
        <h1>QFE – Prem could not load</h1>
        <p>The app encountered a display error. Please copy the technical message below and send it to support.</p>
        <pre style={{whiteSpace:'pre-wrap',background:'#f4f5f7',padding:16,borderRadius:8}}>{String(this.state.error?.stack || this.state.error)}</pre>
        <button onClick={() => window.location.reload()} style={{padding:'10px 16px',cursor:'pointer'}}>Reload app</button>
      </main>;
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');
createRoot(rootElement).render(<AppErrorBoundary><React.StrictMode><App /></React.StrictMode></AppErrorBoundary>);
