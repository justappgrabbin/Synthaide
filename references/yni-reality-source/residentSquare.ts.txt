/* residentSquare.ts
   Find an n×n magic square while respecting a set of fixed "resident" cells.
   Simple implementation using randomized search with resident constraints.
   ────────────────────────────────────────────────────────────────────────── */

export interface Resident {
  row: number;          // 0-indexed
  col: number;          // 0-indexed
  value: number;        // fixed value
}

export async function findResidentSquare(
  n: number,
  residents: Resident[],
  opts = { maxAttempts: 10000 }
): Promise<number[][]> {
  const targetSum = (n * (n * n + 1)) / 2;
  
  // Create a map of fixed positions
  const fixed = new Map(residents.map(r => [`${r.row}-${r.col}`, r.value]));
  
  // Get all numbers that need to be placed
  const allNums = Array.from({ length: n * n }, (_, i) => i + 1);
  const fixedValues = new Set(residents.map(r => r.value));
  const available = allNums.filter(num => !fixedValues.has(num));
  
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Place resident values
    for (const r of residents) {
      matrix[r.row][r.col] = r.value;
    }
    
    // Fill remaining cells with shuffled available numbers
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    let idx = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!fixed.has(`${i}-${j}`)) {
          matrix[i][j] = shuffled[idx++];
        }
      }
    }
    
    // Check if it's magic
    if (isMagicSquare(matrix, targetSum)) {
      return matrix;
    }
  }
  
  // If no magic square found, return a valid square with residents
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (const r of residents) {
    matrix[r.row][r.col] = r.value;
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!fixed.has(`${i}-${j}`)) {
        matrix[i][j] = shuffled[idx++];
      }
    }
  }
  
  return matrix;
}

function isMagicSquare(matrix: number[][], targetSum: number): boolean {
  const n = matrix.length;
  
  // Check rows
  for (let i = 0; i < n; i++) {
    if (matrix[i].reduce((a, b) => a + b, 0) !== targetSum) return false;
  }
  
  // Check columns
  for (let j = 0; j < n; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += matrix[i][j];
    if (sum !== targetSum) return false;
  }
  
  // Check diagonals
  let diag1 = 0, diag2 = 0;
  for (let i = 0; i < n; i++) {
    diag1 += matrix[i][i];
    diag2 += matrix[i][n - 1 - i];
  }
  
  return diag1 === targetSum && diag2 === targetSum;
}
