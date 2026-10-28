import React from 'react';

/**
 * PageContainer
 * Standard content container:
 * - Max width: 1440px (max-w-[1440px])
 * - Centered in remaining viewport area (mx-auto)
 * - Padding: 24px on desktop (md:p-6), 16px on mobile (p-4)
 * - Spacing between cards: 20px (space-y-5)
 */
export const PageContainer = ({ 
  children, 
  className = '', 
  id = undefined 
}) => {
  return (
    <div 
      id={id}
      className={`w-full max-w-[1440px] mx-auto p-4 md:p-6 space-y-5 ${className}`}
    >
      {children}
    </div>
  );
};

export default PageContainer;

