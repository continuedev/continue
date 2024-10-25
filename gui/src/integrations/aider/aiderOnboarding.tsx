import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Button } from '../../components';
import { getLocalStorage, setLocalStorage } from '../../util/localStorage';

const rumbleAnimation = keyframes`
  0% { transform: translate(0, 0); }
  25% { transform: translate(-5px, 5px); }
  50% { transform: translate(5px, -5px); }
  75% { transform: translate(-3px, -3px); }
  100% { transform: translate(0, 0); }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const glowPulse = keyframes`
  0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
  50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.8); }
  100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
`;

const OnboardingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  animation: ${rumbleAnimation} 0.5s ease-in-out;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: ${props => props.theme.textColor};
  animation: ${fadeInUp} 0.8s ease-out forwards;
  opacity: 0;
`;

const Description = styled.p`
  font-size: 1.2rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  color: ${props => props.theme.secondaryText};
  animation: ${fadeInUp} 0.8s ease-out 0.3s forwards;
  opacity: 0;
`;

const FeatureList = styled.ul`
  list-style-type: none;
  padding: 0;
  margin-bottom: 2rem;
  text-align: left;
  animation: ${fadeInUp} 0.8s ease-out 0.6s forwards;
  opacity: 0;
`;

const FeatureItem = styled.li`
  font-size: 1.1rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  position: relative;
  transition: transform 0.3s ease;

  &:before {
    content: "→";
    position: absolute;
    left: 0;
    transition: transform 0.3s ease;
  }

  &:hover {
    transform: translateX(10px);
    
    &:before {
      transform: rotate(90deg);
    }
  }
`;

const StartButton = styled(Button)`
  padding: 1rem 2rem;
  font-size: 1.2rem;
  animation: ${fadeInUp} 0.8s ease-out 0.9s forwards, ${glowPulse} 2s infinite;
  opacity: 0;
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const AiderOnboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Play a subtle rumble sound when the component mounts
    const audio = new Audio('data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==');
    audio.play().catch(() => {
      // Ignore audio play errors
    });
  }, []);

  const handleStart = () => {
    setLocalStorage('hasSeenAiderOnboarding', true);
    navigate('/aiderMode');
  };

  return (
    <OnboardingContainer>
      <Title>Welcome to PearAI Creator</Title>
      <Description>
        Your AI-powered coding companion that helps you build and modify your projects effortlessly.
        Just describe what you want to create or change, and we'll handle the implementation.
      </Description>

      <FeatureList>
        <FeatureItem>Create new features by describing them in plain English</FeatureItem>
        <FeatureItem>Fix bugs and improve existing code naturally</FeatureItem>
        <FeatureItem>Refactor and optimize your codebase effortlessly</FeatureItem>
        <FeatureItem>Get intelligent suggestions and solutions</FeatureItem>
      </FeatureList>

      <StartButton onClick={handleStart}>
        Okay! Let's start creating
      </StartButton>
    </OnboardingContainer>
  );
};

export default AiderOnboarding;
