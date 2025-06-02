import React from 'react';
import { CURATED_FONTS, FontDefinition } from '../constants/fonts';
import { FontLoader } from '../services/font-loader';

interface FontBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFont: (fontFamily: string) => void;
  currentFont: string;
  previewText?: string;
}

const fontLoader = FontLoader.getInstance();

// Categories for filtering
const FONT_CATEGORIES = [
  { id: 'all', label: 'All Fonts' },
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'script', label: 'Script' },
  { id: 'monospace', label: 'Monospace' }
] as const;

// Default preview text
const DEFAULT_PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog';

// Recently used fonts (stored in localStorage)
const RECENT_FONTS_KEY = 'designer-recent-fonts';
const MAX_RECENT_FONTS = 8;

export default function FontBrowser({ 
  isOpen, 
  onClose, 
  onSelectFont, 
  currentFont,
  previewText = DEFAULT_PREVIEW_TEXT 
}: FontBrowserProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [recentFonts, setRecentFonts] = React.useState<string[]>([]);
  const [loadingFonts, setLoadingFonts] = React.useState<Set<string>>(new Set());
  const [visibleFonts, setVisibleFonts] = React.useState<Set<string>>(new Set());
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const fontRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Load recent fonts from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(RECENT_FONTS_KEY);
    if (stored) {
      try {
        setRecentFonts(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load recent fonts:', e);
      }
    }
  }, []);

  // Set up intersection observer for lazy loading
  React.useEffect(() => {
    if (!isOpen) return;

    // Create the observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const fontId = entry.target.getAttribute('data-font-id');
            if (fontId) {
              console.log('Font becoming visible:', fontId);
              setVisibleFonts(prev => new Set(prev).add(fontId));
            }
          }
        });
      },
      { 
        root: null,
        rootMargin: '100px',
        threshold: 0.01
      }
    );

    observerRef.current = observer;

    // Check for fonts already in viewport after a short delay
    setTimeout(() => {
      fontRefs.current.forEach((element, fontId) => {
        const rect = element.getBoundingClientRect();
        const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
        if (inViewport) {
          console.log('Font initially in viewport:', fontId);
          setVisibleFonts(prev => new Set(prev).add(fontId));
        }
      });
    }, 100);

    return () => {
      observer.disconnect();
      fontRefs.current.clear();
      setVisibleFonts(new Set());
    };
  }, [isOpen]);

  // Filter fonts based on search and category
  const filteredFonts = React.useMemo(() => {
    return CURATED_FONTS.filter(font => {
      // Category filter
      if (selectedCategory !== 'all' && font.category !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return font.displayName.toLowerCase().includes(query) ||
               font.family.toLowerCase().includes(query);
      }
      
      return true;
    });
  }, [searchQuery, selectedCategory]);

  // Get recent font objects
  const recentFontObjects = React.useMemo(() => {
    return recentFonts
      .map(fontFamily => CURATED_FONTS.find(f => f.family === fontFamily))
      .filter((f): f is FontDefinition => f !== undefined)
      .slice(0, MAX_RECENT_FONTS);
  }, [recentFonts]);

  // Handle font selection
  const handleSelectFont = async (font: FontDefinition) => {
    // Start loading animation
    setLoadingFonts(prev => new Set(prev).add(font.id));
    
    try {
      // Load the font
      await fontLoader.loadFont(font);
      
      // Update recent fonts
      const newRecent = [font.family, ...recentFonts.filter(f => f !== font.family)].slice(0, MAX_RECENT_FONTS);
      setRecentFonts(newRecent);
      localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(newRecent));
      
      // Callback to parent
      onSelectFont(font.family);
      
      // Close the browser
      onClose();
    } catch (error) {
      console.error('Failed to load font:', error);
    } finally {
      setLoadingFonts(prev => {
        const next = new Set(prev);
        next.delete(font.id);
        return next;
      });
    }
  };

  // Font preview component
  const FontPreview = ({ font, isRecent = false }: { font: FontDefinition; isRecent?: boolean }) => {
    const isVisible = isRecent || visibleFonts.has(font.id);
    const isLoading = loadingFonts.has(font.id);
    const isSelected = font.family === currentFont;
    const isLoaded = fontLoader.isFontLoaded(font.family);
    
    // Debug logging
    React.useEffect(() => {
      if (!isRecent && isVisible) {
        console.log(`Font ${font.id} is now visible`);
      }
    }, [isVisible, font.id, isRecent]);

    return (
      <div
        ref={(el) => {
          if (el && !isRecent) {
            fontRefs.current.set(font.id, el);
            // Start observing this element if observer exists
            if (observerRef.current) {
              observerRef.current.observe(el);
            }
          } else if (!el && !isRecent) {
            // Element is being removed, stop observing
            const existingEl = fontRefs.current.get(font.id);
            if (existingEl && observerRef.current) {
              observerRef.current.unobserve(existingEl);
            }
            fontRefs.current.delete(font.id);
          }
        }}
        data-font-id={font.id}
        onClick={() => !isLoading && handleSelectFont(font)}
        style={{
          padding: '16px',
          borderRadius: '8px',
          cursor: isLoading ? 'wait' : 'pointer',
          backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
          border: isSelected ? '2px solid #0066ff' : '2px solid transparent',
          transition: 'all 0.2s',
          opacity: isLoading ? 0.6 : 1,
          minHeight: '80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          if (!isSelected && !isLoading) {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span style={{ 
            fontSize: '14px', 
            color: '#666',
            fontWeight: 500
          }}>
            {font.displayName}
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {isLoaded && <span style={{ fontSize: '12px', color: '#4caf50' }}>✓</span>}
            {isLoading && (
              <span style={{ 
                fontSize: '12px', 
                color: '#666',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                ⏳
              </span>
            )}
          </div>
        </div>
        
        {/* Font preview - only render if visible */}
        {isVisible ? (
          <div
            style={{
              fontFamily: isLoaded ? font.family : font.fallback,
              fontSize: '24px',
              lineHeight: 1.2,
              color: '#000',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {previewText}
          </div>
        ) : (
          <div style={{ 
            height: '29px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#999'
          }}>
            Loading preview...
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />
      
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '900px',
          height: '80vh',
          maxHeight: '700px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          zIndex: 2001,
          animation: 'slideIn 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Choose a Font</h2>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#666',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>
        
        {/* Controls */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search fonts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0066ff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#ddd';
            }}
          />
          
          {/* Category Filter */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {FONT_CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '20px',
                  backgroundColor: selectedCategory === category.id ? '#0066ff' : '#f0f0f0',
                  color: selectedCategory === category.id ? 'white' : '#666',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.backgroundColor = '#e0e0e0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }
                }}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Font List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {/* Recently Used Section */}
          {recentFontObjects.length > 0 && selectedCategory === 'all' && !searchQuery && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                marginBottom: '16px',
                color: '#333'
              }}>
                Recently Used
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px'
              }}>
                {recentFontObjects.map(font => (
                  <FontPreview key={font.id} font={font} isRecent={true} />
                ))}
              </div>
            </div>
          )}
          
          {/* All Fonts */}
          <div>
            {selectedCategory === 'all' && !searchQuery && recentFontObjects.length > 0 && (
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                marginBottom: '16px',
                color: '#333'
              }}>
                All Fonts
              </h3>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {filteredFonts.map(font => (
                <FontPreview key={font.id} font={font} />
              ))}
            </div>
            
            {filteredFonts.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                color: '#666'
              }}>
                No fonts found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Add animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}} />
    </>
  );
}