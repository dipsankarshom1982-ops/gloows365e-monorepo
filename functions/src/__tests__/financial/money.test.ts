// PATH: functions/src/__tests__/financial/money.test.ts
// Offline unit tests for functions/src/financial/money.ts — pure functions,
// no firebase-admin mocking needed.

import {
  rupeesToPaise,
  paiseToRupees,
  calculatePercentagePaise,
  calculateCommissionPaise,
  assertIntegerPaise,
  InvalidMoneyInputError,
} from "../../financial/money";

describe("rupeesToPaise", () => {
  test("₹0 -> 0 paise", () => {
    expect(rupeesToPaise(0)).toBe(0);
  });
  test("₹1 -> 100 paise", () => {
    expect(rupeesToPaise(1)).toBe(100);
  });
  test("₹500 -> 50000 paise", () => {
    expect(rupeesToPaise(500)).toBe(50000);
  });
  test("large amount: ₹1,000,000 -> 100,000,000 paise", () => {
    expect(rupeesToPaise(1_000_000)).toBe(100_000_000);
  });
  test("2-decimal rupees round correctly: ₹499.99 -> 49999 paise", () => {
    expect(rupeesToPaise(499.99)).toBe(49999);
  });
  test("floating point noise rounds cleanly: ₹19.1 -> 1910 paise", () => {
    // 19.1 * 100 in raw IEEE754 float is 1909.9999999999998 before rounding
    expect(rupeesToPaise(19.1)).toBe(1910);
  });
  test("rejects negative input by default", () => {
    expect(() => rupeesToPaise(-5)).toThrow(InvalidMoneyInputError);
  });
  test("allows negative input when explicitly opted in", () => {
    expect(rupeesToPaise(-5, { allowNegative: true })).toBe(-500);
  });
  test("rejects NaN/Infinity", () => {
    expect(() => rupeesToPaise(NaN)).toThrow(InvalidMoneyInputError);
    expect(() => rupeesToPaise(Infinity)).toThrow(InvalidMoneyInputError);
  });
  test("rejects non-number input", () => {
    expect(() => rupeesToPaise("500" as unknown as number)).toThrow(InvalidMoneyInputError);
  });
});

describe("paiseToRupees", () => {
  test("round trip: rupees -> paise -> rupees", () => {
    expect(paiseToRupees(rupeesToPaise(500))).toBe(500);
    expect(paiseToRupees(rupeesToPaise(1))).toBe(1);
    expect(paiseToRupees(rupeesToPaise(0))).toBe(0);
    expect(paiseToRupees(rupeesToPaise(499.99))).toBe(499.99);
  });
  test("50050 paise -> ₹500.5", () => {
    expect(paiseToRupees(50050)).toBe(500.5);
  });
  test("rejects a non-integer paise value", () => {
    expect(() => paiseToRupees(100.5)).toThrow(InvalidMoneyInputError);
  });
  test("rejects a negative paise value", () => {
    expect(() => paiseToRupees(-100)).toThrow(InvalidMoneyInputError);
  });
});

describe("assertIntegerPaise", () => {
  test("accepts 0 and positive integers", () => {
    expect(() => assertIntegerPaise(0, "x")).not.toThrow();
    expect(() => assertIntegerPaise(50000, "x")).not.toThrow();
  });
  test("rejects decimals", () => {
    expect(() => assertIntegerPaise(100.5, "x")).toThrow(InvalidMoneyInputError);
  });
  test("rejects negative unless explicitly allowed", () => {
    expect(() => assertIntegerPaise(-100, "x")).toThrow(InvalidMoneyInputError);
    expect(() => assertIntegerPaise(-100, "x", { allowNegative: true })).not.toThrow();
  });
});

describe("calculatePercentagePaise", () => {
  test("0% of any amount is 0", () => {
    expect(calculatePercentagePaise(50000, 0)).toBe(0);
  });
  test("100% of amount is the amount itself", () => {
    expect(calculatePercentagePaise(50000, 100)).toBe(50000);
  });
  test("10% of 50000 paise is 5000 paise", () => {
    expect(calculatePercentagePaise(50000, 10)).toBe(5000);
  });
  test("rejects percent > 100", () => {
    expect(() => calculatePercentagePaise(50000, 100.01)).toThrow(InvalidMoneyInputError);
  });
  test("rejects negative percent", () => {
    expect(() => calculatePercentagePaise(50000, -1)).toThrow(InvalidMoneyInputError);
  });
  test("rounding edge case: 33.33% of 100 paise rounds to 33", () => {
    expect(calculatePercentagePaise(100, 33.33)).toBe(33);
  });
  test("rounding edge case: half-paise rounds up (round-half-away-from-zero)", () => {
    // 7 * 50 / 100 = 3.5 -> rounds to 4
    expect(calculatePercentagePaise(7, 50)).toBe(4);
  });
});

describe("calculateCommissionPaise", () => {
  test("is equivalent to calculatePercentagePaise", () => {
    expect(calculateCommissionPaise(50000, 10)).toBe(calculatePercentagePaise(50000, 10));
  });
});
