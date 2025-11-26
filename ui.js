import blessed from 'blessed';
import { theme } from './theme.js';
import { searchAccounts } from './utils.js';
import { randomUUID } from 'crypto';

export class AppUI {
  constructor(db) {
    this.db = db;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Cryptop - Password Manager',
      fullUnicode: true,
      autoPadding: true,
      dockBorders: true
    });
    
    this.state = {
      query: '',
      accounts: [],
      selectedId: null,
      isEditing: false
    };

    // Monkey patch blessed Textarea/Textbox bug if needed or ensure we exit cleanly
    // The error usually happens when an event listener tries to call a callback that doesn't exist
    // or when the screen is destroyed while events are processing.
    
    this.init();
  }

  async init() {
    this.createLayout();
    this.setupEvents();
    this.screen.render();

    // Initial data load
    await this.refreshData();
    this.updateList();
  }

  async refreshData() {
    this.state.accounts = await searchAccounts(this.db, this.state.query);
  }

  _generateMatrixLine(width) {
      const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
      let line = '';
      for(let j=0; j<width; j++) {
         if (Math.random() > 0.95) {
             line += ' ';
         } else {
             line += chars[Math.floor(Math.random() * chars.length)];
         }
      }
      return line;
  }

  _initMatrixLines(w, h) {
      this.matrixLines = [];
      const height = h || 60;
      const width = w || 200;
      for(let i=0; i<height; i++) {
          this.matrixLines.push(this._generateMatrixLine(width));
      }

      return this.matrixLines.join('\n');
  }

  _mutateBackground() {
      if (!this.matrixBg || !this.matrixLines) return;
      
      // Modificar algunas líneas al azar
      const width = this.screen.cols || 200;
      const numMutations = 3; 
      
      for (let k=0; k<numMutations; k++) {
          const lineIdx = Math.floor(Math.random() * this.matrixLines.length);
          const charIdx = Math.floor(Math.random() * width);
          const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ ';
          
          // Reemplazar un caracter en la línea seleccionada
          let line = this.matrixLines[lineIdx];
          if (line.length > charIdx) {
             line = line.substring(0, charIdx) + chars[Math.floor(Math.random() * chars.length)] + line.substring(charIdx + 1);
             this.matrixLines[lineIdx] = line;
          }
      }
      
      this.matrixBg.setContent(this.matrixLines.join('\n'));
      // No llamamos a render aquí explícitamente para evitar sobrecarga, 
      // ya que esto se llama en keypress que usualmente dispara render.
      // Pero si queremos asegurar animación suave:
      // this.screen.render(); 
  }

  createLayout() {
    // Hacker Background (Passe-partout)
    this.matrixBg = blessed.box({
        parent: this.screen,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        content: this._initMatrixLines(this.screen.cols || 200, this.screen.rows || 60),
        style: { 
            fg: theme.syntax.green, 
            bg: '#000000',
            transparent: false
        },
        tags: false
    });

    // Main Container (The actual app window)
    this.mainContainer = blessed.box({
        parent: this.screen,
        top: 2,
        left: 4,
        width: '100%-8',
        height: '100%-4',
        style: { bg: theme.bg.primary },
        border: { type: 'line', fg: theme.syntax.green }
    });

    // Title box - centered, overlapping the top border
    this.titleBox = blessed.box({
        parent: this.screen,
        top: 2,
        left: 'center',
        width: 19,
        height: 1,
        content: ' C R Y P T O P ',
        align: 'center',
        valign: 'middle',
        style: {
            fg: theme.syntax.emerald,
            bg: '#000000',
            bold: true
        }
    });

    this.searchInput = blessed.textbox({
        parent: this.mainContainer,
        top: 0,
        left: 0,
        width: '40%',
        height: 3, 
        inputOnFocus: true,
        keys: true,
        mouse: true,
        border: { type: 'line' },
        style: {
            fg: theme.syntax.cyan,
            bg: theme.bg.input,
            border: { fg: theme.syntax.tertiary },
            focus: { border: { fg: theme.syntax.blue } }
        },
        label: ' Search (/) ',
    });
    this._enableCursorNavigation(this.searchInput);

    // Main Area: List (Left)
    this.list = blessed.list({
      parent: this.mainContainer,
      top: 3,
      left: 0,
      width: '40%',
      bottom: 1,
      items: [],
      keys: true,
      vi: true,
      mouse: true,
      border: { type: 'line' },
      style: {
        bg: theme.bg.primary,
        fg: theme.syntax.white,
        border: { fg: theme.bg.tertiary },
        selected: { bg: theme.bg.hover, fg: theme.syntax.cyan },
        item: { hover: { bg: theme.bg.tertiary } }
      },
      scrollbar: {
          ch: ' ',
          style: { bg: theme.syntax.gray }
      }
    });

    // Details/Edit Area (Right)
    this.detailsBox = blessed.form({
      parent: this.mainContainer,
      top: 0,
      left: '40%',
      width: '60%-2', // Account for border
      bottom: 1,
      border: { type: 'line' },
      style: {
        bg: theme.bg.secondary,
        border: { fg: theme.bg.tertiary }
      }
    });

    this.inputs = {};
    // OTP Secret removed as per request
    const fields = ['Title', 'Website', 'Login', 'Password', 'Notes'];
    let y = 0;
    
    fields.forEach(field => {
        const key = field.toLowerCase().replace(' ', '');

        const input = blessed.textarea({
            parent: this.detailsBox,
            top: y,
            left: 2,
            right: 2,
            height: field === 'Notes' ? 5 : 3,
            inputOnFocus: true,
            keys: true,
            mouse: true,
            border: { type: 'line' },
            label: ` ${field} `,
            style: {
                bg: theme.bg.input,
                fg: theme.syntax.yellow,
                border: { fg: theme.bg.tertiary },
                focus: { border: { fg: theme.syntax.purple } },
                label: { fg: theme.syntax.blue }
            },
            name: key
        });
        
        // Habilitar navegación con cursor (parche para blessed)
        this._enableCursorNavigation(input);
        
        this.inputs[key] = input;
        y += field === 'Notes' ? 5 : 3;
    });

    // Buttons
    this.saveBtn = blessed.button({
        parent: this.detailsBox,
        bottom: 1,
        right: 16,
        width: 12,
        height: 3,
        content: ' Save ',
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            bg: theme.syntax.green,
            fg: theme.bg.primary,
            focus: { bg: theme.syntax.emerald, fg: theme.bg.primary },
            hover: { bg: theme.syntax.emerald, fg: theme.bg.primary }
        }
    });

    this.cancelBtn = blessed.button({
        parent: this.detailsBox,
        bottom: 1,
        right: 2,
        width: 12,
        height: 3,
        content: ' Cancel ',
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            bg: theme.syntax.red,
            fg: theme.bg.primary,
            focus: { bg: theme.syntax.rose, fg: theme.bg.primary },
            hover: { bg: theme.syntax.rose, fg: theme.bg.primary }
        }
    });

    this.deleteBtn = blessed.button({
        parent: this.detailsBox,
        bottom: 1,
        left: 2,
        width: 12,
        height: 3,
        content: ' Delete ',
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            bg: theme.syntax.red,
            fg: theme.bg.primary,
            focus: { bg: theme.syntax.rose, fg: theme.bg.primary },
            hover: { bg: theme.syntax.rose, fg: theme.bg.primary }
        }
    });

    // Status Bar
    this.statusBar = blessed.box({
        parent: this.mainContainer,
        bottom: 0,
        left: 0,
        width: '100%-2',
        height: 1,
        style: { bg: theme.bg.tertiary, fg: theme.syntax.gray },
        content: ' ^C/q: Quit | /: Search | n: New | Enter: Edit | d: Delete | Tab: Switch Focus '
    });

    // Confirmation Modal (initially hidden)
    this.confirmModal = blessed.box({
        parent: this.mainContainer,
        top: 'center',
        left: 'center',
        width: 50,
        height: 12,
        border: { type: 'line' },
        style: {
            bg: theme.bg.secondary,
            fg: theme.syntax.white,
            border: { fg: theme.syntax.red }
        },
        hidden: true,
        label: ' Confirm Delete '
    });

    this.confirmText = blessed.text({
        parent: this.confirmModal,
        top: 1,
        left: 2,
        right: 2,
        content: '',
        style: { fg: theme.syntax.yellow, bg: theme.bg.secondary }
    });

    this.confirmYesBtn = blessed.button({
        parent: this.confirmModal,
        bottom: 1,
        left: 4,
        width: 10,
        height: 3,
        content: ' Yes ',
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            bg: theme.syntax.red,
            fg: theme.bg.primary,
            focus: { bg: theme.syntax.rose, fg: theme.bg.primary },
            hover: { bg: theme.syntax.rose, fg: theme.bg.primary }
        }
    });

    this.confirmNoBtn = blessed.button({
        parent: this.confirmModal,
        bottom: 1,
        right: 4,
        width: 10,
        height: 3,
        content: ' No ',
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            bg: theme.syntax.green,
            fg: theme.bg.primary,
            focus: { bg: theme.syntax.emerald, fg: theme.bg.primary },
            hover: { bg: theme.syntax.emerald, fg: theme.bg.primary }
        }
    });

    this.focusOrder = [
        this.inputs.title,
        this.inputs.website,
        this.inputs.login,
        this.inputs.password,
        // this.inputs.otpsecret, // Removed
        this.inputs.notes,
        this.saveBtn,
        this.cancelBtn,
        this.deleteBtn
    ];
  }

  focusElement(el) {
      if (!el) return;
      el.focus();
      this.screen.render();
  }

  updateList() {
    const items = this.state.accounts.map(acc => {
        return acc.title || acc.website || 'Untitled';
    });
    this.list.setItems(items);
    if (!this.screen.rendering) {
        this.screen.render();
    }
  }

  loadDetails(account) {
      if (!account) {
          Object.keys(this.inputs).forEach(k => this.inputs[k].setValue(''));
      } else {
          this.inputs.title.setValue(account.title || '');
          this.inputs.website.setValue(account.website || '');
          this.inputs.login.setValue(account.login || '');
          this.inputs.password.setValue(account.password || '');
          // this.inputs.otpsecret.setValue(account.otpSecret || '');
          this.inputs.notes.setValue(account.notes || '');
          
          // Reset scroll for notes to top
          if (this.inputs.notes.scrollTo) {
              this.inputs.notes.scrollTo(0);
          }
      }
      if (!this.screen.rendering) {
          this.screen.render();
      }
  }

  getDetailsFromInputs() {
      return {
          title: this.inputs.title.getValue(),
          website: this.inputs.website.getValue(),
          login: this.inputs.login.getValue(),
          password: this.inputs.password.getValue(),
          // otpSecret: this.inputs.otpsecret.getValue(),
          notes: this.inputs.notes.getValue()
      };
  }

  setupEvents() {
      this.screen.on('keypress', () => {
          this._mutateBackground();
          // Force render if needed, usually widgets handle it, but background update needs it
          if (!this.screen.rendering) {
             this.screen.render();
          }
      });

      this.screen.on('resize', () => {
          if (this.matrixBg) {
             this.matrixBg.setContent(this._initMatrixLines(this.screen.cols, this.screen.rows));
             this.screen.render();
          }
      });

      this.screen.key(['C-c', 'q'], () => {
          this.screen.destroy();
          process.exit(0);
      });
      
      this.screen.key(['/'], () => {
          if (!this.confirmModal.hidden) return;
          this.searchInput.focus();
      });

      this.screen.key(['escape'], async () => {
          // Si el modal está visible, cerrarlo
          if (!this.confirmModal.hidden) {
              this.hideDeleteConfirmation();
              return;
          }
          
          // Si hay una búsqueda activa, limpiarla
          if (this.state.query) {
              this.searchInput.setValue('');
              this.state.query = '';
              await this.refreshData();
              this.updateList();
              this.list.focus();
          }
      });

      this.searchInput.on('submit', async () => {
          this.state.query = this.searchInput.getValue();
          await this.refreshData();
          this.updateList();
          this.list.focus();
      });

      this.searchInput.on('cancel', async () => {
          this.searchInput.setValue('');
          this.state.query = '';
          await this.refreshData();
          this.updateList();
          this.list.focus();
      });

      this.list.on('select item', (item, index) => {
          const selectedIndex = this.list.selected;
          const account = this.state.accounts[selectedIndex];
          if (account) {
             this.state.selectedId = account.id;
             this.loadDetails(account);
          }
      });

      this.list.on('select', (item, index) => {
          const account = this.state.accounts[index];
          if (account) {
              this.state.selectedId = account.id;
              this.loadDetails(account);
              this.inputs.title.focus();
          }
      });

      this.screen.key(['n'], () => {
          if (!this.confirmModal.hidden) return;
          this.state.selectedId = null;
          this.loadDetails(null);
          this.inputs.title.focus();
      });

      this.screen.key(['d'], () => {
          if (!this.confirmModal.hidden) return;
          if (this.state.selectedId) {
              this.showDeleteConfirmation();
          }
      });

      this.saveBtn.on('press', () => {
          this.saveCurrent();
      });

      this.cancelBtn.on('press', () => {
          if (this.state.selectedId) {
            const account = this.state.accounts.find(a => a.id === this.state.selectedId);
            this.loadDetails(account);
          } else {
              this.loadDetails(null);
          }
          this.list.focus();
      });

      this.deleteBtn.on('press', () => {
          if (this.state.selectedId) {
              this.showDeleteConfirmation();
          }
      });

      this.confirmYesBtn.on('press', async () => {
          await this.deleteCurrentAccount();
      });

      this.confirmNoBtn.on('press', () => {
          this.hideDeleteConfirmation();
      });

      const moveFocus = (current, direction) => {
          const idx = this.focusOrder.indexOf(current);
          if (idx === -1) {
              if (direction > 0) {
                  this.focusElement(this.focusOrder[0]);
              } else {
                  this.focusElement(this.focusOrder[this.focusOrder.length - 1]);
              }
              return;
          }
          let nextIdx = idx + direction;
          if (nextIdx >= this.focusOrder.length) nextIdx = 0;
          if (nextIdx < 0) nextIdx = this.focusOrder.length - 1;
          this.focusElement(this.focusOrder[nextIdx]);
      };

      this.screen.key(['tab'], () => {
          if (!this.confirmModal.hidden) {
              if (this.screen.focused === this.confirmYesBtn) {
                  this.confirmNoBtn.focus();
              } else {
                  this.confirmYesBtn.focus();
              }
              return false;
          }
          moveFocus(this.screen.focused, 1);
          return false;
      });

      this.screen.key(['S-tab'], () => {
          if (!this.confirmModal.hidden) {
              if (this.screen.focused === this.confirmYesBtn) {
                  this.confirmNoBtn.focus();
              } else {
                  this.confirmYesBtn.focus();
              }
              return false;
          }
          moveFocus(this.screen.focused, -1);
          return false;
      });

      const orderedInputs = [
          this.inputs.title,
          this.inputs.website,
          this.inputs.login,
          this.inputs.password,
          // this.inputs.otpsecret,
          this.inputs.notes
      ];

      orderedInputs.forEach((input, idx) => {
          // Cuando se envía el input (Enter), ir al siguiente
          if (input.name !== 'notes') {
            input.on('submit', () => {
                if (idx === orderedInputs.length - 1) {
                    this.focusElement(this.saveBtn);
                } else {
                    this.focusElement(orderedInputs[idx + 1]);
                }
            });
          }

          // Cuando se cancela (Escape), volver a la lista
          input.on('cancel', () => {
              this.list.focus();
          });
          
          // Reset state on blur
          if (input.name === 'notes') {
              input.on('blur', () => {
                 input._isEditing = false;
                 if (input.style && input.style.border) {
                    input.style.border.fg = theme.bg.tertiary;
                 }
              });
          }

          input.key(['tab'], () => {
              // Salir del modo input antes de cambiar foco
              input.cancel();
              moveFocus(input, 1);
              return false;
          });
          input.key(['S-tab'], () => {
              // Salir del modo input antes de cambiar foco
              input.cancel();
              moveFocus(input, -1);
              return false;
          });
          
          input.key(['down'], () => {
              // Si estamos en notes y editando, no cambiar foco
              if (input.name === 'notes' && input._isEditing) return;

              // Salir del modo input antes de cambiar foco
              input.cancel();
              if (idx === orderedInputs.length - 1) {
                  this.focusElement(this.saveBtn);
              } else {
                  this.focusElement(orderedInputs[idx + 1]);
              }
              return false;
          });
          input.key(['up'], () => {
              // Si estamos en notes y editando, no cambiar foco
              if (input.name === 'notes' && input._isEditing) return;

              // Salir del modo input antes de cambiar foco
              input.cancel();
              if (idx === 0) {
                  this.focusElement(this.list);
              } else {
                  this.focusElement(orderedInputs[idx - 1]);
              }
              return false;
          });
      });

      this.saveBtn.key(['tab'], () => {
          moveFocus(this.saveBtn, 1);
          return false;
      });
      this.saveBtn.key(['S-tab'], () => {
          moveFocus(this.saveBtn, -1);
          return false;
      });
      this.saveBtn.key(['down'], () => {
          moveFocus(this.saveBtn, 1);
          return false;
      });
      this.saveBtn.key(['up'], () => {
          this.focusElement(orderedInputs[orderedInputs.length - 1]);
          return false;
      });

      this.cancelBtn.key(['tab'], () => {
          moveFocus(this.cancelBtn, 1);
          return false;
      });
      this.cancelBtn.key(['S-tab'], () => {
          moveFocus(this.cancelBtn, -1);
          return false;
      });
      this.cancelBtn.key(['down'], () => {
          moveFocus(this.cancelBtn, 1);
          return false;
      });
      this.cancelBtn.key(['up'], () => {
          moveFocus(this.cancelBtn, -1);
          return false;
      });

      this.deleteBtn.key(['tab'], () => {
          moveFocus(this.deleteBtn, 1);
          return false;
      });
      this.deleteBtn.key(['S-tab'], () => {
          moveFocus(this.deleteBtn, -1);
          return false;
      });
      this.deleteBtn.key(['down'], () => {
          moveFocus(this.deleteBtn, 1);
          return false;
      });
      this.deleteBtn.key(['up'], () => {
          moveFocus(this.deleteBtn, -1);
          return false;
      });

      // Modal events
      this.confirmYesBtn.key(['tab'], () => {
          this.confirmNoBtn.focus();
          return false;
      });
      this.confirmNoBtn.key(['tab'], () => {
          this.confirmYesBtn.focus();
          return false;
      });
      this.confirmYesBtn.key(['S-tab'], () => {
          this.confirmNoBtn.focus();
          return false;
      });
      this.confirmNoBtn.key(['S-tab'], () => {
          this.confirmYesBtn.focus();
          return false;
      });
      this.confirmYesBtn.key(['right'], () => {
          this.confirmNoBtn.focus();
          return false;
      });
      this.confirmNoBtn.key(['left'], () => {
          this.confirmYesBtn.focus();
          return false;
      });
      this.confirmYesBtn.key(['escape'], () => {
          this.hideDeleteConfirmation();
          return false;
      });
      this.confirmNoBtn.key(['escape'], () => {
          this.hideDeleteConfirmation();
          return false;
      });
      
      this.list.focus();
  }

  async saveCurrent() {
      const data = this.getDetailsFromInputs();
      
      if (!data.title && !data.website) {
           return;
      }

      let id = this.state.selectedId;
      if (!id) {
          id = randomUUID();
          data.created_at = new Date().toISOString();
      }

      data.updated_at = new Date().toISOString();
      data.id = id;

      await this.db.set("accounts", id, data);

      this.state.query = ''; 
      await this.refreshData();
      this.updateList();
      this.list.focus();
  }

  showDeleteConfirmation() {
      const account = this.state.accounts.find(a => a.id === this.state.selectedId);
      if (!account) return;

      const accountName = account.title || account.website || 'this account';
      this.confirmText.setContent(`Are you sure you want to delete:\n\n"${accountName}"?\n\nThis action cannot be undone.`);
      
      this.confirmModal.show();
      this.confirmYesBtn.focus();
      if (!this.screen.rendering) {
          this.screen.render();
      }
  }

  hideDeleteConfirmation() {
      this.confirmModal.hide();
      this.list.focus();
      if (!this.screen.rendering) {
          this.screen.render();
      }
  }

  _enableCursorNavigation(input) {
      input._cursorOffset = 0;
      const originalListener = input._listener;
      
      // Override listener to handle cursor movement and editing at cursor position
      input._listener = (ch, key) => {
          // Special keys that should bubble or be handled by default
          if (['tab'].includes(key.name)) {
              return originalListener ? originalListener.call(input, ch, key) : undefined;
          }

          if (input.name === 'notes') {
              // Navigation Mode (Not editing)
              if (!input._isEditing) {
                   if (key.name === 'enter') {
                       input._isEditing = true;
                       if (input.style && input.style.border) {
                           input.style.border.fg = theme.syntax.green; // Highlight active state
                       }
                       input.screen.render();
                       return;
                   }
                   
                   // Pass navigation keys to be handled by setupEvents (bubbling logic)
                   if (['up', 'down', 'escape'].includes(key.name)) {
                       return originalListener ? originalListener.call(input, ch, key) : undefined;
                   }
                   
                   // Block typing in navigation mode
                   return;
              }

              // Editing Mode
              if (key.name === 'escape') {
                  input._isEditing = false;
                  if (input.style && input.style.border) {
                      input.style.border.fg = theme.bg.tertiary; // Restore style
                  }
                  input.screen.render();
                  return;
              }
              
              // Handle custom Up/Down for cursor movement inside notes
              if (['up', 'down'].includes(key.name)) {
                 const lines = input.value.split('\n');
                 let currentPos = input.value.length - (input._cursorOffset || 0);
                 
                 // Find current line index and col
                 let cursorLine = 0;
                 let cursorCol = 0;
                 let charCount = 0;
                 
                 for(let i=0; i<lines.length; i++) {
                     let lineLen = lines[i].length;
                     let segmentLen = lineLen + 1; // +1 for \n
                     if (i === lines.length - 1) segmentLen = lineLen; 
    
                     if (currentPos <= charCount + lineLen) {
                         cursorLine = i;
                         cursorCol = currentPos - charCount;
                         break;
                     }
                     charCount += segmentLen;
                 }
    
                 if (key.name === 'up') {
                     if (cursorLine > 0) {
                         let prevLineLen = lines[cursorLine-1].length;
                         let newCol = Math.min(cursorCol, prevLineLen);
                         
                         let newAbsPos = 0;
                         for(let i=0; i<cursorLine-1; i++) {
                             newAbsPos += lines[i].length + 1;
                         }
                         newAbsPos += newCol;
                         
                         input._cursorOffset = input.value.length - newAbsPos;
                         input.screen.render();
                     }
                 } else if (key.name === 'down') {
                     if (cursorLine < lines.length - 1) {
                         let nextLineLen = lines[cursorLine+1].length;
                         let newCol = Math.min(cursorCol, nextLineLen);
                         
                         let newAbsPos = 0;
                         for(let i=0; i<=cursorLine; i++) {
                             newAbsPos += lines[i].length + 1;
                         }
                         newAbsPos += newCol;
                         
                         input._cursorOffset = input.value.length - newAbsPos;
                         input.screen.render();
                     }
                 }
                 return; // Consumed
              }
          }

          // Allow up/down to bubble for non-notes (navigation)
          if (input.name !== 'notes' && ['up', 'down'].includes(key.name)) {
             return originalListener ? originalListener.call(input, ch, key) : undefined;
          }

          if (key.name === 'enter') {
               if (input.name === 'notes') {
                   // Must be editing mode to reach here
                   const pos = input.value.length - input._cursorOffset;
                   
                   // Calculate which line the cursor is on before modification
                   const textBefore = input.value.substring(0, pos);
                   const cursorLine = textBefore.split('\n').length - 1;
                   
                   // Save scroll
                   const savedScroll = input.childBase || 0;
                   
                   // Insert newline
                   input.value = input.value.slice(0, pos) + '\n' + input.value.slice(pos);
                   
                   // Override setValue to prevent scroll reset
                   // Blessed textarea sets childBase in render based on cursor position
                   // We need to intercept this. Let's use setImmediate to restore after render cycle.
                   
                   input.screen.render();
                   
                   // Force restore scroll after render
                   setImmediate(() => {
                       input.childBase = savedScroll;
                       input.screen.render();
                   });
                   
                   return;
               }
               input._cursorOffset = 0;
               return originalListener.call(input, ch, key);
          }
          
          if (key.name === 'escape') {
               input._cursorOffset = 0;
               return originalListener.call(input, ch, key);
          }

          let handled = false;

          if (key.name === 'left') {
              if (input.value.length > input._cursorOffset) {
                  input._cursorOffset++;
                  handled = true;
              }
          } else if (key.name === 'right') {
              if (input._cursorOffset > 0) {
                  input._cursorOffset--;
                  handled = true;
              }
          } else if (key.name === 'home') {
              input._cursorOffset = input.value.length;
              handled = true;
          } else if (key.name === 'end') {
              input._cursorOffset = 0;
              handled = true;
          } else if (key.name === 'backspace') {
               if (input.value.length - input._cursorOffset > 0) {
                   const pos = input.value.length - input._cursorOffset;
                   input.value = input.value.slice(0, pos - 1) + input.value.slice(pos);
                   handled = true;
               }
          } else if (key.name === 'delete') {
               if (input._cursorOffset > 0) {
                   const pos = input.value.length - input._cursorOffset;
                   input.value = input.value.slice(0, pos) + input.value.slice(pos + 1);
                   input._cursorOffset--;
                   handled = true;
               }
          } else if (ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
              const pos = input.value.length - input._cursorOffset;
              input.value = input.value.slice(0, pos) + ch + input.value.slice(pos);
              handled = true;
          }

          if (handled) {
              if (input.name === 'notes') {
                  // Save scroll position before render
                  const savedScroll = input.childBase || 0;
                  input.screen.render();
                  // Restore scroll after render cycle
                  setImmediate(() => {
                      input.childBase = savedScroll;
                      input.screen.render();
                  });
              } else {
                  input.screen.render();
              }
          }
      };

      // Override _updateCursor to render cursor at correct position
      input._updateCursor = function(get) {
         if (this.screen.focused !== this) return;
         
         var lpos = get ? this.lpos : this._getCoords();
         if (!lpos) return;

         var program = this.screen.program;
         
         // Calculate visual X/Y position supporting multiline (basic)
         var cursorIndex = this.value.length - (this._cursorOffset || 0);
         var textBefore = this.value.substring(0, cursorIndex);
         var lines = textBefore.split('\n');
         var lineY = lines.length - 1;
         var lineX = lines[lines.length - 1].length;
         
         var cy = lpos.yi + this.itop + lineY;
         // Simple width calc - assumes no horizontal scrolling
         var cx = lpos.xi + this.ileft + lineX; // this.strWidth(lines[lineY])?
         
         // Simple bounds check
         if (cx > lpos.xl - this.iright) cx = lpos.xl - this.iright;
         if (cy > lpos.yl - this.ibottom) cy = lpos.yl - this.ibottom;

         if (cy === program.y && cx === program.x) return;
         program.cup(cy, cx);
      };
  }

  async deleteCurrentAccount() {
      if (!this.state.selectedId) return;

      // Delete from database
      await this.db.del("accounts", this.state.selectedId);

      // Clear selection and inputs
      this.state.selectedId = null;
      this.loadDetails(null);

      // Hide modal
      this.confirmModal.hide();

      // Refresh list
      this.state.query = '';
      await this.refreshData();
      this.updateList();
      this.list.focus();
      if (!this.screen.rendering) {
          this.screen.render();
      }
  }
}
