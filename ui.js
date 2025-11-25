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

  createLayout() {
    // Background
    this.background = blessed.box({
        parent: this.screen,
        style: { bg: theme.bg.primary }
    });

    // Top Bar (Search & Title)
    this.topBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      style: { bg: theme.bg.secondary },
      content: ''
    });

    this.titleText = blessed.text({
        parent: this.topBar,
        top: 1,
        left: 2,
        content: '{bold}Cryptop{/bold}',
        tags: true,
        style: { fg: theme.syntax.purple, bg: theme.bg.secondary }
    });

    this.searchInput = blessed.textbox({
        parent: this.topBar,
        top: 0,
        right: 2,
        height: 3, 
        width: 40,
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
      parent: this.screen,
      top: 3,
      left: 0,
      width: '40%',
      height: '100%-4', 
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
      parent: this.screen,
      top: 3,
      left: '40%',
      width: '60%',
      height: '100%-4',
      border: { type: 'line' },
      style: {
        bg: theme.bg.secondary,
        border: { fg: theme.bg.tertiary }
      }
    });

    this.inputs = {};
    const fields = ['Title', 'Website', 'Login', 'Password', 'OTP Secret', 'Notes'];
    let y = 1;
    
    fields.forEach(field => {
        const key = field.toLowerCase().replace(' ', '');
        
        blessed.text({
            parent: this.detailsBox,
            top: y,
            left: 2,
            content: field + ':',
            style: { fg: theme.syntax.blue, bg: theme.bg.secondary }
        });

        const input = blessed.textbox({
            parent: this.detailsBox,
            top: y + 1,
            left: 2,
            right: 2,
            height: field === 'Notes' ? 6 : 3,
            inputOnFocus: true,
            keys: true,
            mouse: true,
            border: { type: 'line' },
            style: {
                bg: theme.bg.input,
                fg: theme.syntax.yellow,
                border: { fg: theme.bg.tertiary },
                focus: { border: { fg: theme.syntax.purple } }
            },
            name: key
        });
        
        // Habilitar navegación con cursor (parche para blessed)
        this._enableCursorNavigation(input);
        
        this.inputs[key] = input;
        
        this.inputs[key] = input;
        y += field === 'Notes' ? 7 : 4;
    });

    // Buttons
    this.saveBtn = blessed.button({
        parent: this.detailsBox,
        bottom: 2,
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
        bottom: 2,
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
        bottom: 2,
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
        parent: this.screen,
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        style: { bg: theme.bg.tertiary, fg: theme.syntax.gray },
        content: ' ^C/q: Quit | /: Search | n: New | Enter: Edit | d: Delete | Tab: Switch Focus '
    });

    // Confirmation Modal (initially hidden)
    this.confirmModal = blessed.box({
        parent: this.screen,
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
        this.inputs.otpsecret,
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
          this.inputs.otpsecret.setValue(account.otpSecret || '');
          this.inputs.notes.setValue(account.notes || '');
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
          otpSecret: this.inputs.otpsecret.getValue(),
          notes: this.inputs.notes.getValue()
      };
  }

  setupEvents() {
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
          this.inputs.otpsecret,
          this.inputs.notes
      ];

      orderedInputs.forEach((input, idx) => {
          // Cuando se envía el input (Enter), ir al siguiente
          input.on('submit', () => {
              if (idx === orderedInputs.length - 1) {
                  this.focusElement(this.saveBtn);
              } else {
                  this.focusElement(orderedInputs[idx + 1]);
              }
          });

          // Cuando se cancela (Escape), volver a la lista
          input.on('cancel', () => {
              this.list.focus();
          });

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
          if (['up', 'down', 'tab'].includes(key.name)) {
              return originalListener ? originalListener.call(input, ch, key) : undefined;
          }
          if (key.name === 'enter' || key.name === 'escape') {
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
              input.screen.render();
          }
      };

      // Override _updateCursor to render cursor at correct position
      input._updateCursor = function(get) {
         if (this.screen.focused !== this) return;
         
         var lpos = get ? this.lpos : this._getCoords();
         if (!lpos) return;

         var program = this.screen.program;
         var cy = lpos.yi + this.itop;
         
         // Calculate visual X position
         var cursorIndex = this.value.length - (this._cursorOffset || 0);
         var textBefore = this.value.substring(0, cursorIndex);
         
         // Simple calculation assuming no horizontal scrolling for now
         var cx = lpos.xi + this.ileft + this.strWidth(textBefore);
         
         // Simple bounds check
         if (cx > lpos.xl - this.iright) cx = lpos.xl - this.iright;

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
