# CertiFlow 🎓

A powerful web-based application for batch certificate generation and automated email delivery.

![CertiFlow](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 📜 Certificate Generation
- **Upload PDF Templates**: Use any PDF as your certificate template
- **Visual Field Editor**: Drag-and-drop positioning for dynamic text fields
- **Customizable Styling**: Font family, size, color, weight, and alignment
- **Batch Processing**: Generate thousands of certificates from CSV files
- **Custom Naming**: Flexible file naming patterns with placeholders
- **Local Storage**: Choose where to save generated certificates

### 📧 Email Delivery
- **WYSIWYG Email Editor**: Rich text editing with HTML support
- **Template Management**: Save and reuse email templates
- **Placeholder Support**: Dynamic content like `{{name}}`, `{{event_name}}`
- **Gmail Integration**: Built-in SMTP configuration for Gmail
- **Rate Limiting**: Automatic delays to avoid email provider bans
- **Delivery Tracking**: Real-time status for each recipient
- **Retry Failed**: One-click retry for failed emails

### 📊 Dashboard & Monitoring
- **Job Progress**: Real-time progress tracking with Socket.IO
- **Statistics**: Overview of certificates generated and emails sent
- **Recipient Management**: Filter and paginate through recipients
- **Error Reporting**: Detailed error messages for troubleshooting

## 🛠️ Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- TipTap for WYSIWYG email editing
- Fabric.js for visual field positioning
- Socket.IO for real-time updates

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM with SQLite
- pdf-lib for PDF generation
- Nodemailer for email delivery
- Socket.IO for real-time communication

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/certiflow.git
   cd certiflow
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up the database**
   ```bash
   cd server
   npm run db:generate
   npm run db:push
   npm run db:seed
   cd ..
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

5. **Open the app**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:4000

## 📁 Project Structure

```
CertiFlow/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── services/       # API and Socket clients
│   └── ...
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── lib/            # Utilities
│   └── prisma/             # Database schema
├── sample-data/            # Test data files
└── README.md
```

## 📝 Usage Guide

### Step 1: Upload Certificate Template

1. Navigate to **Certificates** page
2. Upload your PDF certificate template
3. Give it a descriptive name

### Step 2: Configure Fields

1. Add dynamic fields (e.g., `name`, `email`, `event_name`)
2. Position fields on the template using drag-and-drop
3. Customize font, size, color, and alignment
4. Save the configuration

### Step 3: Upload CSV Data

1. Prepare a CSV with columns matching your field names
2. Required columns: `name` (or `full_name`), `email`
3. Upload the CSV file
4. Verify the data preview

### Step 4: Generate Certificates

1. Choose output folder path
2. Set file naming pattern (e.g., `{{sn}}_{{name}}.pdf`)
3. Click "Generate Certificates"
4. Monitor progress in real-time

### Step 5: Send Emails

1. Navigate to **Email** page
2. Create or select an email template
3. Select the certificate batch job
4. Configure SMTP (Gmail)
5. Send test email first
6. Start batch sending

## ⚙️ SMTP Configuration (Gmail)

1. Enable 2-Factor Authentication on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create a new App Password for "Mail"
4. Use these settings in CertiFlow:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587` (TLS)
   - **Username**: Your Gmail address
   - **Password**: The 16-character App Password

### Gmail Sending Limits
- **Free Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day
- **Recommended delay**: 3000ms (3 seconds) between emails

## 🗂️ Sample Files

Check the `sample-data/` folder for:
- `participants.csv` - Sample CSV with 10 test participants

## 📄 API Endpoints

### Templates
- `POST /api/templates/certificate` - Upload certificate template
- `GET /api/templates/certificate` - List templates
- `PUT /api/templates/certificate/:id` - Update template
- `POST /api/templates/email` - Create email template
- `GET /api/templates/email` - List email templates

### Certificates
- `POST /api/certificates/preview` - Preview certificate
- `POST /api/certificates/generate` - Start batch generation
- `GET /api/certificates/download/:id` - Download single certificate
- `GET /api/certificates/download-all/:jobId` - Download all as ZIP

### Email
- `POST /api/email/preview` - Preview email
- `POST /api/email/test-send` - Send test email
- `POST /api/email/send-batch` - Start batch sending

### Jobs
- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job details
- `GET /api/jobs/:id/progress` - Get job progress
- `POST /api/jobs/:id/retry-failed` - Retry failed recipients

### Settings
- `GET /api/settings` - Get app settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/smtp` - Add SMTP config
- `POST /api/settings/smtp/test` - Test SMTP connection

## 🔒 Security

- SMTP passwords are stored (consider encryption for production)
- File uploads are validated for type and size
- Rate limiting on email sending prevents abuse

## 📦 Production Deployment

### Build
```bash
npm run build
```

### Environment Variables
Create a `.env` file in the server directory:
```env
PORT=4000
DATABASE_URL="file:./data/certiflow.db"
NODE_ENV=production
```

### Recommended Hosting
- **VPS**: DigitalOcean, Linode, AWS EC2
- **PaaS**: Railway, Render
- **Docker**: Use the provided docker-compose.yml

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using React, Node.js, and pdf-lib
