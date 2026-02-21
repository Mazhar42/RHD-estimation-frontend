import { useState } from 'react';
import { motion } from 'framer-motion';
import LoginForm from '../../components/auth/LoginForm';
import RegisterForm from '../../components/auth/RegisterForm';

const LoginPage = () => {
  const [showRegister, setShowRegister] = useState(false);

  const handleAuthSuccess = () => {
    console.log('Authentication successful');
  };

  const toggleForm = () => {
    setShowRegister(!showRegister);
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="w-full flex items-start justify-center">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-2xl px-8 py-16"
        >
          {showRegister ? (
            <RegisterForm onToggleForm={toggleForm} onSuccess={handleAuthSuccess} />
          ) : (
            <LoginForm onToggleForm={toggleForm} onSuccess={handleAuthSuccess} />
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
