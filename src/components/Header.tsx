import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';
import './Header.css';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link to="/">AI SEO Blog Generator</Link>
        </div>
        
        <button className="hamburger" onClick={toggleMenu} aria-label="Toggle navigation menu">
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        
        <nav className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <ul>
            <li><Link to="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
            <li><Link to="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
            <li><Link to="/contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
            <li><Link to="/privacy" onClick={() => setMenuOpen(false)}>Privacy Policy</Link></li>
            <li><Link to="/terms" onClick={() => setMenuOpen(false)}>Terms of Use</Link></li>
            <li>
              {!loading && (
                user ? (
                  <button onClick={logout} className="auth-button">
                    Logout
                  </button>
                ) : (
                  <button 
                    onClick={() => setAuthModalOpen(true)} 
                    className="auth-button get-started"
                  >
                    Get Started
                  </button>
                )
              )}
            </li>
          </ul>
        </nav>
      </div>

      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />
    </header>
  );
};

export default Header;