// 🎉 初めてのテスト！
// このテストは必ず成功するので安心してください

describe('初めてのテスト', () => {
  test('2 + 2 は 4 になる', () => {
    expect(2 + 2).toBe(4);
  });

  test('文字列が正しく動作する', () => {
    expect('hello').toBe('hello');
  });

  test('配列に要素が含まれているか', () => {
    const fruits = ['apple', 'banana', 'orange'];
    expect(fruits).toContain('banana');
  });
});