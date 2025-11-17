# 📦 HierarchyFlow - Dependencies & Requirements

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

---

## 🏗️ System Requirements

### **Runtime Environment**
- **Node.js:** v22.13.0 or higher (LTS recommended)
- **npm:** v11.6.0 or higher
- **Operating System:** Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory:** Minimum 4GB RAM (8GB recommended)
- **Storage:** 2GB free space

### **Database Requirements**
- **MongoDB:** v4.4 or higher (v6.0+ recommended)
- **Connection:** Local or cloud-based (MongoDB Atlas supported)

---

## 📋 Production Dependencies

### **Core Framework**
```json
{
  "next": "15.3.3",           // React framework
  "react": "^18.3.1",         // UI library
  "react-dom": "^18.3.1"      // DOM rendering
}
```

### **Authentication & Security**
```json
{
  "bcryptjs": "^2.4.3",       // Password hashing
  "jsonwebtoken": "^9.0.2"    // JWT token management
}
```

### **Database & ORM**
```json
{
  "mongoose": "^8.8.0"       // MongoDB ODM
}
```

### **UI Components & Styling**
```json
{
  "@radix-ui/react-*": "^1.1.6", // UI component library
  "tailwindcss": "^3.4.1",      // CSS framework
  "class-variance-authority": "^0.7.1", // Component variants
  "clsx": "^2.1.1",              // CSS class utilities
  "tailwind-merge": "^3.0.1"     // Tailwind class merging
}
```

### **Form Handling & Validation**
```json
{
  "react-hook-form": "^7.54.2",   // Form management
  "@hookform/resolvers": "^4.1.3", // Form validation
  "zod": "^3.24.2"                // Schema validation
}
```

### **Document Generation**
```json
{
  "docxtemplater": "^3.45.2",    // DOCX template processing
  "pizzip": "^3.1.7"              // ZIP file handling
}
```

### **Notifications & Communication**
```json
{
  "@sendgrid/mail": "^7.7.0",     // Email service
  "twilio": "^4.21.0"             // SMS service
}
```

### **AI Integration**
```json
{
  "@genkit-ai/google-genai": "1.20.0", // Google AI integration
  "genkit": "1.20.0",                   // AI framework
  "genkitx-ollama": "1.20.0"            // Ollama integration
}
```

### **Real-time Communication**
```json
{
  "socket.io": "^4.7.5",          // WebSocket server
  "socket.io-client": "^4.7.5"    // WebSocket client
}
```

### **Data Visualization**
```json
{
  "recharts": "^2.15.1"           // Chart library
}
```

### **Date & Time**
```json
{
  "date-fns": "^3.6.0"             // Date utilities
}
```

### **Utilities**
```json
{
  "uuid": "^9.0.1",               // Unique ID generation
  "dotenv": "^16.5.0",             // Environment variables
  "lucide-react": "^0.475.0"       // Icon library
}
```

---

## 🔧 Development Dependencies

### **TypeScript & Build Tools**
```json
{
  "typescript": "^5",             // TypeScript compiler
  "@types/node": "^20",           // Node.js types
  "@types/react": "^18",          // React types
  "@types/react-dom": "^18",      // React DOM types
  "@types/bcryptjs": "^2.4.6",    // bcrypt types
  "@types/jsonwebtoken": "^9.0.10" // JWT types
}
```

### **Development Tools**
```json
{
  "genkit-cli": "1.20.0",         // AI development CLI
  "postcss": "^8"                  // CSS processing
}
```

---

## 🚨 Security Dependencies

### **Vulnerability Status:**
- **bcryptjs:** ✅ No known vulnerabilities
- **jsonwebtoken:** ✅ Latest secure version
- **mongoose:** ✅ Regular security updates

### **Security Recommendations:**
1. **Regular Updates:** Run `npm audit` monthly
2. **Dependency Scanning:** Use `npm audit fix` for automatic fixes
3. **Security Headers:** Configure in production
4. **Environment Variables:** Never commit secrets

---

## 🔧 Installation Instructions

### **Quick Start (Development)**
```bash
# 1. Clone repository
git clone <repository-url>
cd hierarchyflow

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

### **Production Deployment**
```bash
# 1. Install dependencies
npm ci --only=production

# 2. Build application
npm run build

# 3. Start production server
npm start
```

---

## ⚙️ Environment Configuration

### **Required Environment Variables**
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/hierarchyflow

# Authentication
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars
REFRESH_SECRET=your-secure-refresh-secret-minimum-32-chars

# Optional Services
GOOGLE_AI_API_KEY=your-google-ai-key   # For AI features
```

---

## 📊 Compatibility Matrix

| Dependency | Minimum Version | Recommended | Latest Tested |
|------------|-----------------|-------------|---------------|
| Node.js    | 18.0.0         | 22.13.0     | 22.13.0       |
| npm        | 9.0.0          | 11.6.0      | 11.6.0        |
| MongoDB    | 4.4.0          | 6.0.0       | 7.0.0         |
| React      | 18.0.0         | 18.3.1      | 18.3.1        |
| Next.js    | 14.0.0         | 15.3.3      | 15.3.3        |

---

## 🔍 Troubleshooting

### **Common Issues:**

#### **1. MongoDB Connection Errors**
```bash
# Error: MongooseError: Operation users.findOne() buffering timed out
# Solution: Set MONGODB_URI environment variable
export MONGODB_URI="mongodb://localhost:27017/hierarchyflow"
```

#### **2. Build Failures**
```bash
# Error: Module not found
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### **3. TypeScript Errors**
```bash
# Error: Type compilation failed
# Solution: Run type checking
npm run typecheck
```

---

## 📈 Performance Considerations

### **Bundle Size Optimization:**
- **Total Bundle:** ~175KB for main dashboard
- **Code Splitting:** Automatic with Next.js
- **Tree Shaking:** Enabled by default
- **Image Optimization:** Next.js Image component

### **Runtime Performance:**
- **Server-Side Rendering:** Enabled
- **Static Generation:** Where applicable
- **Client Hydration:** Optimized
- **Caching Strategy:** Implemented

---

## 🔄 Update Strategy

### **Monthly Maintenance:**
```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Security audit
npm audit
npm audit fix
```

### **Major Updates:**
1. **Test in development environment first**
2. **Check breaking changes in changelogs**
3. **Update one major dependency at a time**
4. **Run full test suite after updates**

---

**Document Version:** 1.0
**Last Verified:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Next Review:** 30 days