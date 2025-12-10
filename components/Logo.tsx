
import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", showText = true }) => {
  const [imgError, setImgError] = useState(false);
  
  // مسار الصورة المخصصة. 
  // يجب إنشاء مجلد باسم img داخل المجلد public ووضع الصورة logo2.png بداخله.
  // استخدام المسار المطلق /img/logo2.png يضمن الوصول للصورة من أي صفحة.
  const customLogoPath = "/img/logo2.png";

  // إذا لم يحدث خطأ في تحميل الصورة، نعرض الصورة المخصصة فقط
  // هذا سيستبدل الشعار الافتراضي واسم التطبيق بالكامل
  if (!imgError) {
    return (
      <img 
        src={customLogoPath} 
        alt="شعار الشركة" 
        className={`${className} object-contain`} 
        onError={() => setImgError(true)}
      />
    );
  }

  // في حال عدم وجود الصورة أو حدوث خطأ، نعرض الشعار القديم الافتراضي كاحتياط
  return (
    <div className="flex items-center gap-3">
      <svg 
        className={className} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        
        <path 
          d="M50 10 L90 90 H10 L50 10 Z" 
          fill="url(#logoGradient)" 
          opacity="0.2"
        />
        
        <rect x="25" y="60" width="10" height="30" rx="2" fill="url(#logoGradient)" />
        <rect x="45" y="40" width="10" height="50" rx="2" fill="url(#logoGradient)" />
        <rect x="65" y="20" width="10" height="70" rx="2" fill="url(#logoGradient)" />
        
        <path 
          d="M20 80 L40 50 L60 70 L90 30" 
          stroke="white" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300" style={{ fontFamily: 'Tajawal' }}>
            العالمية برو
          </span>
          <span className="text-xs font-semibold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
            Alalmiyh POS
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
