import { cn } from "@/lib/utils";

interface ButtonType {
  type: "quick_reply" | "url" | "phone_number";
  text: string;
}

interface PhonePreviewProps {
  headerType?: string;
  headerText?: string;
  headerImage?: string;
  body: string;
  footer?: string;
  buttons?: ButtonType[];
  className?: string;
}

export function PhonePreview({
  headerType,
  headerText,
  headerImage,
  body,
  footer,
  buttons,
  className,
}: PhonePreviewProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative w-[280px]">
        <div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-xl">
          <div className="bg-gray-800 rounded-t-[2rem] pt-6 pb-2 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">WhatsApp Business</div>
                <div className="text-gray-400 text-xs">online</div>
              </div>
            </div>
          </div>
          
          <div 
            className="bg-[#0b141a] min-h-[380px] px-3 py-4 overflow-y-auto"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23172630' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-[#005c4b] rounded-lg overflow-hidden shadow-sm">
                {headerType === "image" && headerImage && (
                  <img 
                    src={headerImage} 
                    alt="Header" 
                    className="w-full h-32 object-cover"
                  />
                )}
                {headerType === "image" && !headerImage && (
                  <div className="w-full h-32 bg-gray-700 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                <div className="p-2">
                  {headerType === "text" && headerText && (
                    <p className="text-white font-semibold text-sm mb-1">{headerText}</p>
                  )}
                  
                  <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
                    {body || "Your message will appear here..."}
                  </p>
                  
                  {footer && (
                    <p className="text-gray-400 text-xs mt-2 pt-1 border-t border-gray-600">
                      {footer}
                    </p>
                  )}

                  {/* Buttons Section */}
                  {buttons && buttons.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          disabled
                          className="text-xs bg-gray-700 text-white rounded px-2 py-1 max-w-full truncate text-left disabled:opacity-80"
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <svg className="w-4 h-4 text-blue-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-b-[2rem] py-3 px-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-700 rounded-full px-4 py-2">
                <span className="text-gray-400 text-sm">Type a message</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14.016l5.016-5.016 1.406 1.406-6.422 6.422-6.422-6.422 1.406-1.406z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}