import React from 'react';

interface MediaBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  shop: string;
  sessionId?: string;
  customerId?: string;
}

interface UserAsset {
  id: string;
  url: string;
  filename: string;
  filesize: number;
  width?: number;
  height?: number;
  mimetype: string;
  tags: string[];
  createdAt: string;
}

export default function MediaBrowser({
  isOpen,
  onClose,
  onSelectImage,
  shop,
  sessionId,
  customerId
}: MediaBrowserProps) {
  // Debug logging
  console.log('[MediaBrowser] Received props:', { shop, sessionId, customerId });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string>('all');
  const [assets, setAssets] = React.useState<UserAsset[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedAsset, setSelectedAsset] = React.useState<string | null>(null);

  // Load assets when modal opens and migrate if needed
  React.useEffect(() => {
    if (isOpen) {
      // If user is logged in and has a sessionId, migrate assets first
      if (customerId && sessionId) {
        migrateAssets().then(() => loadAssets());
      } else {
        loadAssets();
      }
    }
  }, [isOpen, sessionId, customerId]);

  const migrateAssets = async () => {
    try {
      console.log('[MediaBrowser] Attempting to migrate assets from sessionId to customerId');
      
      // Check if we're running through the Shopify App Proxy
      const isProxyAccess = window.location.hostname.includes('.myshopify.com');
      const apiPath = isProxyAccess ? '/apps/designer/api/assets/migrate' : '/api/assets/migrate';
      
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop,
          sessionId,
          customerId
        })
      });
      
      const result = await response.json();
      if (result.success && result.migratedCount > 0) {
        console.log(`[MediaBrowser] Successfully migrated ${result.migratedCount} assets`);
        // Clear sessionId from localStorage after successful migration
        localStorage.removeItem('mediaBrowserSessionId');
      }
    } catch (error) {
      console.error('[MediaBrowser] Failed to migrate assets:', error);
      // Don't block loading if migration fails
    }
  };

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('shop', shop);
      if (sessionId) params.append('sessionId', sessionId);
      if (customerId) params.append('customerId', customerId);
      
      // Check if we're running through the Shopify App Proxy
      const isProxyAccess = window.location.hostname.includes('.myshopify.com');
      const apiPath = isProxyAccess ? '/apps/designer/api/assets/list' : '/api/assets/list';
      
      const response = await fetch(`${apiPath}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetType', 'userImage');
    formData.append('shop', shop);
    if (sessionId) formData.append('sessionId', sessionId);
    if (customerId) formData.append('customerId', customerId);

    try {
      setUploadProgress(0);
      // Check if we're running through the Shopify App Proxy
      const isProxyAccess = window.location.hostname.includes('.myshopify.com');
      const apiPath = isProxyAccess ? '/apps/designer/api/assets/upload' : '/api/assets/upload';
      
      const response = await fetch(apiPath, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        // Reload assets to show the new upload
        await loadAssets();
        setUploadProgress(null);
      } else {
        alert(`Upload failed: ${result.error}`);
        setUploadProgress(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
      setUploadProgress(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredAssets = React.useMemo(() => {
    return assets.filter(asset => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return asset.filename.toLowerCase().includes(query) ||
               asset.tags.some(tag => tag.toLowerCase().includes(query));
      }
      return true;
    });
  }, [assets, searchQuery]);

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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Media Library</h2>
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
            placeholder="Search images..."
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
          
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0052cc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0066ff';
            }}
          >
            <span>+</span> Upload Image
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files)}
          />
        </div>
        
        {/* Login Prompt for Anonymous Users */}
        {!customerId && (
          <div style={{
            margin: '16px 24px',
            padding: '12px 16px',
            backgroundColor: '#fff9e6',
            border: '1px solid #f0e0b0',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '14px', color: '#6b5900' }}>
              You are not signed in. Images will be saved temporarily. 
              <a 
                href={(() => {
                  if (window.location.hostname.includes('.myshopify.com')) {
                    // Build the full return URL including all query params
                    const currentFullUrl = window.location.pathname + window.location.search;
                    return `/customer_authentication/login?return_to=${encodeURIComponent(currentFullUrl)}&locale=en`;
                  }
                  return '/auth/login'; // Merchant auth - unchanged
                })()} 
                style={{ marginLeft: '8px', color: '#0066ff', textDecoration: 'none' }}
              >
                Sign in to save permanently →
              </a>
            </span>
          </div>
        )}
        
        {/* Image Grid or Dropzone */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {/* Dropzone Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#0066ff' : '#ddd'}`,
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              backgroundColor: isDragging ? '#f0f7ff' : '#fafafa',
              marginBottom: '24px',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }}>📁</div>
            <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#666' }}>
              Drag and drop images here
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>
              or click to browse
            </p>
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
              Loading your images...
            </div>
          )}
          
          {/* Image Grid */}
          {!isLoading && filteredAssets.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  onClick={() => {
                    setSelectedAsset(asset.id);
                    onSelectImage(asset.url);
                    onClose();
                  }}
                  style={{
                    border: selectedAsset === asset.id ? '2px solid #0066ff' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    aspectRatio: '1',
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#333',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '4px'
                    }}>
                      {asset.filename}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#999',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{formatFileSize(asset.filesize)}</span>
                      {asset.width && asset.height && (
                        <span>{asset.width} × {asset.height}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Empty State */}
          {!isLoading && filteredAssets.length === 0 && !searchQuery && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🖼️</div>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No images yet</p>
              <p style={{ fontSize: '14px', color: '#999' }}>
                Upload your first image to get started
              </p>
            </div>
          )}
          
          {/* No Results */}
          {!isLoading && filteredAssets.length === 0 && searchQuery && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
              No images found matching "{searchQuery}"
            </div>
          )}
        </div>
        
        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '200px',
              height: '4px',
              backgroundColor: '#e0e0e0',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#0066ff',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <span style={{ fontSize: '14px', color: '#666' }}>Uploading...</span>
          </div>
        )}
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
      `}} />
    </>
  );
}