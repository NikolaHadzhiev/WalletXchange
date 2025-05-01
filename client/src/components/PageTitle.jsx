import { useState, useEffect } from 'react';

function PageTitle({title}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      <h1 
        className={`${isMobile ? 'text-lg' : 'text-xl'} uppercase sm-text-center`}
        style={{ 
          wordBreak: 'break-word',
          maxWidth: '100%',
          lineHeight: isMobile ? '1.3' : 'inherit'
        }}
      >
        {title}
      </h1>
    </>
  )
}

export default PageTitle