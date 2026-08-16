// script.js — safe parser (shunting-yard) + RPN evaluator, memory, PWA install handling, and UI improvements
const display = document.getElementById('display');
const keys = document.querySelector('.keys');
const installBtn = document.getElementById('installBtn');
const installRow = document.querySelector('.install-row');
const installHint = document.getElementById('installHint');
let expr = ''; // user-visible expression (infix)
let memory = 0;
let deferredPrompt = null;

function updateDisplay(){ display.value = expr || '0'; }

// Utility: is operator
const operators = {
  '+': {prec: 2, assoc: 'L'},
  '-': {prec: 2, assoc: 'L'},
  '*': {prec: 3, assoc: 'L'},
  '/': {prec: 3, assoc: 'L'},
  '^': {prec: 4, assoc: 'R'}
};

function isOperator(tok){ return Object.prototype.hasOwnProperty.call(operators, tok); }

// Tokenize: numbers, functions, operators, parentheses
function tokenize(s){
  const tokens = [];
  s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  const re = /\s*([0-9]*\.?[0-9]+|[A-Za-z]+|\^|\+|\-|\*|\/|\(|\)|%)/g;
  let m;
  while ((m = re.exec(s)) !== null){ tokens.push(m[1]); }
  return tokens;
}

// Shunting-yard -> to RPN
function toRPN(tokens){
  const out = [];
  const stack = [];
  for (let i=0;i<tokens.length;i++){
    const t = tokens[i];
    if (!isNaN(t)) { out.push(t); continue; }
    if (t === '%') { // treat percent as immediate divide by 100 applied to previous number
      out.push('100'); out.push('/'); continue;
    }
    if (/^[A-Za-z]+$/.test(t)) { // function name
      stack.push(t);
      continue;
    }
    if (isOperator(t)){
      while (stack.length){
        const top = stack[stack.length-1];
        if (isOperator(top) && ((operators[t].assoc === 'L' && operators[t].prec <= operators[top].prec) || (operators[t].assoc === 'R' && operators[t].prec < operators[top].prec))){
          out.push(stack.pop());
          continue;
        }
        break;
      }
      stack.push(t);
      continue;
    }
    if (t === '('){ stack.push(t); continue; }
    if (t === ')'){
      while (stack.length && stack[stack.length-1] !== '(') out.push(stack.pop());
      stack.pop(); // remove '('
      // if function on top, pop to output
      if (stack.length && /^[A-Za-z]+$/.test(stack[stack.length-1])) out.push(stack.pop());
      continue;
    }
    // unknown token - throw
    throw new Error('Invalid token: ' + t);
  }
  while (stack.length){
    const top = stack.pop();
    if (top === '(' || top === ')') throw new Error('Mismatched parentheses');
    out.push(top);
  }
  return out;
}

// RPN evaluator
function evalRPN(rpn){
  const st = [];
  for (const tok of rpn){
    if (!isNaN(tok)) { st.push(parseFloat(tok)); continue; }
    if (isOperator(tok)){
      const b = st.pop(); const a = st.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      switch(tok){
        case '+': st.push(a+b); break;
        case '-': st.push(a-b); break;
        case '*': st.push(a*b); break;
        case '/': st.push(a/b); break;
        case '^': st.push(Math.pow(a,b)); break;
      }
      continue;
    }
    // functions
    switch(tok.toLowerCase()){
      case 'sqrt':{ const v=st.pop(); st.push(Math.sqrt(v)); break; }
      case 'sin':{ const v=st.pop(); st.push(Math.sin(v)); break; }
      case 'cos':{ const v=st.pop(); st.push(Math.cos(v)); break; }
      case 'tan':{ const v=st.pop(); st.push(Math.tan(v)); break; }
      case 'ln':{ const v=st.pop(); st.push(Math.log(v)); break; }
      case 'abs':{ const v=st.pop(); st.push(Math.abs(v)); break; }
      default: throw new Error('Unknown function: ' + tok);
    }
  }
  if (st.length !== 1) throw new Error('Invalid expression');
  return st[0];
}

function calculateExpression(input){
  if (!input) return '';
  const tokens = tokenize(input);
  const rpn = toRPN(tokens);
  const result = evalRPN(rpn);
  return result;
}

// Append value (handling decimals)
function appendValue(val){
  // prevent multiple decimals in a number
  if (val === '.'){
    // find last token
    const parts = expr.match(/([0-9]*\.?[0-9]+|[^0-9])/g) || [];
    const last = parts.length? parts[parts.length-1] : '';
    if (typeof last === 'string' && last.includes('.')) return;
  }
  expr += val;
  updateDisplay();
}

// Apply a function onto the current expression: wraps expression or number
function applyFunction(fn){
  // if expr ends with a number, wrap that number: e.g., 5 -> sqrt(5)
  const m = expr.match(/(\d+\.?\d*)$/);
  if (m){
    const num = m[1];
    expr = expr.slice(0, -num.length) + fn + '(' + num + ')';
  } else {
    expr += fn + '(';
  }
  updateDisplay();
}

function doCalculate(){
  try{
    // sanitize: allow digits, operators, letters, parentheses, dot, percent
    if (!/^[0-9A-Za-z+\-*/^().%\s]*$/.test(expr)) { display.value = 'Error'; expr=''; return; }
    const res = calculateExpression(expr);
    // handle small rounding errors
    const rounded = Math.round((res + Number.EPSILON) * 1e12) / 1e12;
    expr = String(rounded);
    updateDisplay();
  } catch (e){
    display.value = 'Error'; expr = '';
  }
}

keys.addEventListener('click', e =>{
  const btn = e.target.closest('button'); if (!btn) return;
  const val = btn.dataset.value;
  const action = btn.dataset.action;
  const fn = btn.dataset.fn;

  if (action === 'clear'){ expr=''; updateDisplay(); return; }
  if (action === 'back'){ expr = expr.slice(0,-1); updateDisplay(); return; }
  if (action === 'percent'){
    // append percent token which the parser treats as /100
    expr += '%'; updateDisplay(); return;
  }
  if (action === 'equals'){ doCalculate(); return; }

  if (action && action.startsWith('m')){
    // memory ops
    if (action === 'mc') { memory = 0; installHint.textContent = 'Memory cleared'; setTimeout(()=>installHint.textContent='',1500); return; }
    if (action === 'mr') { expr += String(memory); updateDisplay(); return; }
    if (action === 'mplus') { try{ const val = calculateExpression(expr); memory += Number(val); installHint.textContent = 'Added to memory'; setTimeout(()=>installHint.textContent='',1500);} catch(_){installHint.textContent='Memory error'; setTimeout(()=>installHint.textContent='',1500);} return; }
    if (action === 'mminus') { try{ const val = calculateExpression(expr); memory -= Number(val); installHint.textContent = 'Subtracted from memory'; setTimeout(()=>installHint.textContent='',1500);} catch(_){installHint.textContent='Memory error'; setTimeout(()=>installHint.textContent='',1500);} return; }
  }

  if (fn){ applyFunction(fn); return; }
  if (val) appendValue(val);
});

// keyboard support
window.addEventListener('keydown', e =>{
  const k = e.key;
  if ((k >= '0' && k <= '9') || k === '.') { appendValue(k); return; }
  if (['+','-','*','/','^'].includes(k)) { appendValue(k); return; }
  if (k === 'Enter' || k === '='){ e.preventDefault(); doCalculate(); return; }
  if (k === 'Backspace'){ expr = expr.slice(0,-1); updateDisplay(); return; }
  if (k === 'Escape'){ expr=''; updateDisplay(); return; }
});

updateDisplay();

// --- PWA: service worker registration and install prompt handling ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  deferredPrompt = e; // Save the event for later
  installRow.setAttribute('aria-hidden','false');
  installBtn.style.display = 'inline-block';
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    // On Safari or unsupported browsers, show hint
    installHint.textContent = 'To install: use your browser menu (Add to Home screen)';
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    installHint.textContent = 'App installed';
  } else {
    installHint.textContent = 'Install dismissed';
  }
  deferredPrompt = null;
  setTimeout(()=>installHint.textContent='',2000);
});

// provide manual hint for platforms that don't fire beforeinstallprompt
if (!('BeforeInstallPromptEvent' in window)){
  // show hint text for some browsers (e.g., Safari)
  installHint.textContent = 'Use browser menu → Add to Home Screen';
}
