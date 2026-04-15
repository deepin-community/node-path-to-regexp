"use strict";
/* global describe, it */

const { expect } = require("chai");
const {
  parse,
  compile,
  match,
  stringify,
  pathToRegexp,
  TokenData,
  PathError,
} = require("../dist/index.js");

/**
 * Path-to-regexp test suite converted from vitest to mocha/chai
 */
describe("path-to-regexp", function () {
  describe("ParseError", function () {
    it("should contain original path and debug url", function () {
      const error = new PathError(
        "Unexpected end at index 7, expected }",
        "/{:foo,"
      );

      expect(error).to.be.instanceof(TypeError);
      expect(error.message).to.equal(
        "Unexpected end at index 7, expected }: /{:foo,; visit https://git.new/pathToRegexpError for info"
      );
      expect(error.originalPath).to.equal("/{:foo,");
    });

    it("should omit original url when undefined", function () {
      const error = new PathError(
        "Unexpected end at index 7, expected }",
        undefined
      );

      expect(error).to.be.instanceof(TypeError);
      expect(error.message).to.equal(
        "Unexpected end at index 7, expected }; visit https://git.new/pathToRegexpError for info"
      );
      expect(error.originalPath).to.be.undefined;
    });
  });

  describe("parse errors", function () {
    it("should throw on unbalanced group", function () {
      expect(() => parse("/{:foo,")).to.throw(
        PathError,
        "Unexpected end at index 7, expected }"
      );
    });

    it("should throw on nested unbalanced group", function () {
      expect(() => parse("/{:foo/{x,y}")).to.throw(
        PathError,
        "Unexpected end at index 12, expected }"
      );
    });

    it("should throw on missing param name", function () {
      expect(() => parse("/:/")).to.throw(
        PathError,
        "Missing parameter name at index 2"
      );
    });

    it("should throw on missing wildcard name", function () {
      expect(() => parse("/*/")).to.throw(
        PathError,
        "Missing parameter name at index 2"
      );
    });

    it("should throw on unterminated quote", function () {
      expect(() => parse('/:"foo')).to.throw(
        PathError,
        "Unterminated quote at index 2"
      );
    });
  });

  describe("compile errors", function () {
    it("should throw when a param is missing", function () {
      const toPath = compile("/a/:b/c");

      expect(() => toPath()).to.throw(TypeError, "Missing parameters: b");
    });

    it("should throw when expecting a repeated value", function () {
      const toPath = compile("/*foo");

      expect(() => toPath({ foo: [] })).to.throw(
        TypeError,
        'Expected "foo" to be a non-empty array'
      );
    });

    it("should throw when param gets an array", function () {
      const toPath = compile("/:foo");

      expect(() => toPath({ foo: [] })).to.throw(
        TypeError,
        'Expected "foo" to be a string'
      );
    });

    it("should throw when a wildcard is not an array", function () {
      const toPath = compile("/*foo");

      expect(() => toPath({ foo: "a" })).to.throw(
        TypeError,
        'Expected "foo" to be a non-empty array'
      );
    });

    it("should throw when a wildcard array value is not a string", function () {
      const toPath = compile("/*foo");

      expect(() => toPath({ foo: [1, "a"] })).to.throw(
        TypeError,
        'Expected "foo/0" to be a string'
      );
    });
  });

  describe("pathToRegexp errors", function () {
    it("should throw when missing text between params", function () {
      expect(() => pathToRegexp("/:foo:bar")).to.throw(
        PathError,
        'Missing text before "bar" param'
      );
    });

    it("should throw when missing text between params using TokenData", function () {
      expect(() =>
        pathToRegexp(
          new TokenData([
            { type: "param", name: "a" },
            { type: "param", name: "b" },
          ])
        )
      ).to.throw(PathError, 'Missing text before "b" param');
    });

    it("should throw with `originalPath` when missing text between params using TokenData", function () {
      expect(() =>
        pathToRegexp(
          new TokenData(
            [
              { type: "param", name: "a" },
              { type: "param", name: "b" },
            ],
            "/[a][b]"
          )
        )
      ).to.throw(PathError, 'Missing text before "b" param');
    });
  });

  describe("stringify errors", function () {
    it("should error on unknown token", function () {
      expect(() =>
        stringify({ tokens: [{ type: "unknown", value: "test" }] })
      ).to.throw(TypeError, "Unknown token type: unknown");
    });
  });

  describe("parse", function () {
    const PARSER_TESTS = [
      {
        path: "/",
        expected: new TokenData([{ type: "text", value: "/" }], "/"),
      },
      {
        path: "/:test",
        expected: new TokenData(
          [
            { type: "text", value: "/" },
            { type: "param", name: "test" },
          ],
          "/:test"
        ),
      },
      {
        path: "/:a:b",
        expected: new TokenData(
          [
            { type: "text", value: "/" },
            { type: "param", name: "a" },
            { type: "param", name: "b" },
          ],
          "/:a:b"
        ),
      },
      {
        path: '/:"0"',
        expected: new TokenData(
          [
            { type: "text", value: "/" },
            { type: "param", name: "0" },
          ],
          '/:\"0\"'
        ),
      },
      {
        path: "/*path",
        expected: new TokenData(
          [
            { type: "text", value: "/" },
            { type: "wildcard", name: "path" },
          ],
          "/*path"
        ),
      },
    ];

    PARSER_TESTS.forEach(function (testCase) {
      it("should parse " + testCase.path, function () {
        const data = parse(testCase.path);
        expect(data).to.deep.equal(testCase.expected);
      });
    });
  });

  describe("stringify", function () {
    const STRINGIFY_TESTS = [
      {
        data: new TokenData([{ type: "text", value: "/" }]),
        expected: "/",
      },
      {
        data: new TokenData([
          { type: "text", value: "/" },
          { type: "param", name: "test" },
        ]),
        expected: "/:test",
      },
      {
        data: new TokenData([
          { type: "text", value: "/" },
          { type: "param", name: "0" },
        ]),
        expected: '/:"0"',
      },
      {
        data: new TokenData([
          { type: "text", value: "/" },
          { type: "wildcard", name: "test" },
        ]),
        expected: "/*test",
      },
    ];

    STRINGIFY_TESTS.forEach(function (testCase) {
      it("should stringify to " + testCase.expected, function () {
        const path = stringify(testCase.data);
        expect(path).to.equal(testCase.expected);
      });
    });
  });

  describe("compile", function () {
    const COMPILE_TESTS = [
      {
        path: "/",
        tests: [
          { input: undefined, expected: "/" },
          { input: {}, expected: "/" },
          { input: { id: "123" }, expected: "/" },
        ],
      },
      {
        path: "/test",
        tests: [
          { input: undefined, expected: "/test" },
          { input: {}, expected: "/test" },
        ],
      },
      {
        path: "/:test",
        tests: [
          { input: undefined, expected: null },
          { input: {}, expected: null },
          { input: { test: "123" }, expected: "/123" },
          { input: { test: "123/xyz" }, expected: "/123%2Fxyz" },
        ],
      },
      {
        path: "/*test",
        tests: [
          { input: undefined, expected: null },
          { input: {}, expected: null },
          { input: { test: [] }, expected: null },
          { input: { test: ["123"] }, expected: "/123" },
          { input: { test: ["123", "xyz"] }, expected: "/123/xyz" },
        ],
      },
      {
        path: "{/:test}",
        tests: [
          { input: undefined, expected: "" },
          { input: {}, expected: "" },
          { input: { test: undefined }, expected: "" },
          { input: { test: "123" }, expected: "/123" },
        ],
      },
    ];

    COMPILE_TESTS.forEach(function (testCase) {
      describe("compile " + JSON.stringify(testCase.path), function () {
        testCase.tests.forEach(function (test) {
          it("should compile with input " + JSON.stringify(test.input), function () {
            const toPath = compile(testCase.path);

            if (test.expected === null) {
              expect(() => toPath(test.input)).to.throw();
            } else {
              expect(toPath(test.input)).to.equal(test.expected);
            }
          });
        });
      });
    });
  });

  describe("match", function () {
    const MATCH_TESTS = [
      {
        path: "/",
        tests: [
          {
            input: "/",
            expected: { path: "/", params: {} },
          },
          { input: "/route", expected: false },
        ],
      },
      {
        path: "/test",
        tests: [
          {
            input: "/test",
            expected: { path: "/test", params: {} },
          },
          { input: "/route", expected: false },
          { input: "/test/route", expected: false },
          {
            input: "/test/",
            expected: { path: "/test/", params: {} },
          },
        ],
      },
      {
        path: "/:test",
        tests: [
          {
            input: "/route",
            expected: { path: "/route", params: { test: "route" } },
          },
          {
            input: "/route/",
            expected: { path: "/route/", params: { test: "route" } },
          },
          {
            input: "/route.json",
            expected: {
              path: "/route.json",
              params: { test: "route.json" },
            },
          },
          {
            input: "/route/test",
            expected: false,
          },
        ],
      },
      {
        path: "/test",
        options: { sensitive: true },
        tests: [
          {
            input: "/test",
            expected: { path: "/test", params: {} },
          },
          { input: "/TEST", expected: false },
        ],
      },
      {
        path: "/test",
        options: { end: false },
        tests: [
          {
            input: "/test",
            expected: { path: "/test", params: {} },
          },
          {
            input: "/test/",
            expected: { path: "/test/", params: {} },
          },
          {
            input: "/test/route",
            expected: { path: "/test", params: {} },
          },
        ],
      },
      {
        path: "/*test",
        tests: [
          {
            input: "/",
            expected: false,
          },
          {
            input: "/foo",
            expected: { path: "/foo", params: { test: ["foo"] } },
          },
          {
            input: "/foo/bar",
            expected: { path: "/foo/bar", params: { test: ["foo", "bar"] } },
          },
        ],
      },
    ];

    MATCH_TESTS.forEach(function (testCase) {
      describe(
        "match " + JSON.stringify(testCase.path) +
        (testCase.options ? " with options " + JSON.stringify(testCase.options) : ""),
        function () {
          testCase.tests.forEach(function (test) {
            it("should match " + test.input, function () {
              const fn = match(testCase.path, testCase.options);
              expect(fn(test.input)).to.deep.equal(test.expected);
            });
          });
        }
      );
    });
  });

  describe("pathToRegexp", function () {
    it("should create regexp from path", function () {
      const result = pathToRegexp("/:foo/:bar");
      expect(result).to.be.an("object");
      expect(result.regexp).to.be.instanceof(RegExp);
      expect(result.keys).to.be.an("array");

      const match = result.regexp.exec("/test/route");
      expect(match).to.not.be.null;
      expect(match[0]).to.equal("/test/route");
    });

    it("should work with options", function () {
      const result = pathToRegexp("/test", { end: false });
      expect(result.regexp.test("/test/route")).to.be.true;
      expect(result.regexp.test("/test")).to.be.true;
    });

    it("should handle case sensitivity", function () {
      const resultSensitive = pathToRegexp("/test", { sensitive: true });
      expect(resultSensitive.regexp.test("/test")).to.be.true;
      expect(resultSensitive.regexp.test("/TEST")).to.be.false;

      const resultInsensitive = pathToRegexp("/test");
      expect(resultInsensitive.regexp.test("/test")).to.be.true;
      expect(resultInsensitive.regexp.test("/TEST")).to.be.true;
    });
  });
});
