# Cryptop 🔐

**Cryptop** is a modern terminal-based password manager, specially designed for users looking to migrate from the discontinued Dropbox Passwords service.

## Why Cryptop?

Dropbox discontinued its password management service, leaving many users with exported CSV files that need a safe home. Cryptop allows you to:

- ✅ **Easily import** your exported Dropbox passwords (CSV format)
- ✅ **Strong encryption** using AES-256 to protect your data
- ✅ **Intuitive terminal interface** with keyboard navigation
- ✅ **Completely offline** - your passwords stay on your machine
- ✅ **Local encrypted database** secured with your master password

## Features

- 🔍 **Fast search** with real-time filtering
- 📝 **Full editor** to create, edit and organize your passwords
- 🎨 **Modern interface** with dark theme and custom colors
- 🔐 **OTP support** (One-Time Password secrets)
- ⌨️ **Keyboard shortcuts** for efficient navigation
- 💾 **Automatic encrypted saving**

## Installation

### Global Installation

```bash
npm install -g cryptop
```

## Usage

### Import CSV from Dropbox

If you have a CSV file exported from Dropbox Passwords:

```bash
cryptop exported_dropbox_accounts.csv
```

The program will ask for a **master password** that will be used to encrypt all your data. **Remember this password!** - without it you won't be able to access your accounts.

The CSV should have the following columns:
- `title` - Account title
- `website` - Website URL
- `login` - Username or email
- `password` - Password
- `otpSecret` - (Optional) Secret for OTP/2FA codes
- `notes` - (Optional) Additional notes

### Launch the Interface

To open the password manager:

```bash
cryptop
```

Enter your master password to unlock the encrypted database.

## Keyboard Shortcuts

### General Navigation
- `/` - Open search
- `ESC` - Clear search / Close confirmation dialogs
- `n` - Create new account
- `d` - Delete selected account (with confirmation)
- `Enter` - Edit selected account
- `Tab` / `Shift+Tab` - Navigate between fields
- `↑` / `↓` - Navigate the list
- `Ctrl+C` / `q` - Quit

### In the Editor
- `Enter` - Go to next field
- `ESC` - Cancel editing
- `Tab` - Next field
- "Save" button - Save changes
- "Cancel" button - Discard changes
- "Delete" button - Delete current account (with confirmation)

## Security

- 🔒 **AES-256 encryption**: Your passwords are encrypted with your master password
- 🚫 **No cloud storage**: Everything is saved locally in `~/.cryptop/db.json`
- 🔑 **Single master password**: You only need to remember one password
- 💻 **No internet connection**: Doesn't send data to any server

### ⚠️ Important

1. **Never lose your master password** - there's no way to recover your data without it
2. Make **regular backups** of the `~/.cryptop/db.json` file
3. The database is stored in your home directory at `~/.cryptop/db.json`
4. Use a **strong password** as your master password

## File Structure

### Project Files
```
.
├── index.js            # Main entry point
├── ui.js               # User interface
├── persist.js          # Persistence layer with encryption
├── utils.js            # Utilities
└── theme.js            # Color configuration
```

### User Data
```
~/.cryptop/
└── db.json        # Encrypted database (created automatically)
```

## Migrating from Dropbox Passwords

1. Export your passwords from Dropbox:
   - Open Dropbox Passwords
   - Go to Settings → Export
   - Save the CSV file

2. Import to Cryptop:
   ```bash
   cryptop exported_dropbox_accounts.csv
   ```

3. Enter a secure master password

4. Done! Your passwords are secure and ready to use

## Development

### Requirements
- Node.js 14 or higher

### Dependencies
- `blessed` - Terminal interface framework
- `crypto-js` - AES encryption
- `csv-parse` - CSV file parser
- `deepbase` - Simple file-based database

## License

ISC

## Contributing

Contributions are welcome. Please open an issue or pull request.

---

**Note**: This project is not affiliated with Dropbox Inc. It is an independent tool created to help users manage their passwords locally after the discontinuation of the Dropbox Passwords service.

