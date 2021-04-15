# emmet-ls

Emmet support based on LSP.  
Started as [coc-emmet](https://github.com/neoclide/coc-emmet) replacement for [completion-nvim](https://github.com/nvim-lua/completion-nvim). Should work with any lsp client but not tested.

![alt](./.image/capture.gif)


#### Install
```
npm install -g emmet-ls
```

#### Configuration 

- [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
  ```lua
  require'lspconfig/configs'.emmet_ls = {
    default_config = {
      cmd = {'emmet-ls', '--stdio'},
      filetypes = {'html', 'css'},
      root_dir = require'lspconfig'.util.root_pattern(".git", vim.fn.getcwd()),
    }
  }

  require'lspconfig'.emmet_ls.setup{
    on_attach = on_attach;
  }
  ```
- [completion-nvim](https://github.com/nvim-lua/completion-nvim)

  Completion is triggered if completion_trigger_character is entered. 
  It's limitation of completion-nvim.

  ```lua
  let g:completion_trigger_character = ['.']
  ```
  If you have set it like this, You will have to add trailing '.' after emmet abbreviation.
  ```
  div>h.
  ```
  And it will be expanded to 
  ```
  <div>
    <h class=""></h>
  </div>
  ```





