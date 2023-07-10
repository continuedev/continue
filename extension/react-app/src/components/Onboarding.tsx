import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import React, { useState } from 'react';


const Onboarding = () => {
    const [counter, setCounter] = useState(0);

    const handleClick = () => {
        setCounter(counter + 1);
    }

    const vscMediaUrl = useSelector(
        (state: RootStore) => state.config.vscMediaUrl
      );

    return (
    <div style={{position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: '#1E1E1E', zIndex: 200 }} onClick={handleClick}>
    {counter === 0 && (
    <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
    <h1>Welcome to Continue!</h1>
    <img src={`${vscMediaUrl}/intro.gif`} alt="Intro" />
    </div>
    )}
    {counter === 1 && (
    <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
    <h1>Answer coding questions</h1>
    <img src={`${vscMediaUrl}/explain.gif`} alt="Explain" />
    <p style={{ fontSize: '16px', paddingLeft: '50px', paddingRight: '50px', textAlign: 'center' }}>Ask Continue about a part of your code to get another perspective</p>
    </div>
    )}
    {counter === 2 && (
    <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
    <h1>Edit in natural language</h1>
    <img src={`${vscMediaUrl}/edit.gif`} alt="Edit" />
    <p style={{ fontSize: '16px', paddingLeft: '50px', paddingRight: '50px', textAlign: 'center' }}>Highlight a section of code and instruct Continue to refactor it</p>
    </div>
    )}
    {counter === 3 && (
    <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
    <h1>Generate files from scratch</h1>
    <img src={`${vscMediaUrl}/generate.gif`} alt="Generate" />
    <p style={{ fontSize: '16px', paddingLeft: '50px', paddingRight: '50px', textAlign: 'center' }}>Let Continue build the scaffolding of Python scripts, React components, and more</p>
    </div>
    )}
    <p style={{ paddingLeft: '50px', paddingRight: '50px', paddingBottom: '50px', textAlign: 'center' }}>Click to learn how to use Continue...</p>
    </div>
    );
}

export default Onboarding;
