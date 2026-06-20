/**
 * Language-specific boilerplate/starter code templates.
 * Displayed when a user selects a new programming language in the editor.
 */

const BOILERPLATES = {
  javascript: `// JavaScript - Hello World
// A simple starter template

function greet(name) {
  return \`Hello, \${name}! Welcome to Collaborative Platform.\`;
}

// Main execution
const message = greet("World");
console.log(message);

// Try editing this code collaboratively!
`,

  typescript: `// TypeScript - Hello World
// A typed starter template

interface User {
  name: string;
  role: "host" | "collaborator";
}

function greet(user: User): string {
  return \`Hello, \${user.name}! You are a \${user.role}.\`;
}

// Main execution
const user: User = { name: "World", role: "host" };
console.log(greet(user));
`,

  python: `# Python - Hello World
# A simple starter template

def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}! Welcome to Collaborative Platform."


def main():
    message = greet("World")
    print(message)


if __name__ == "__main__":
    main()
`,

  java: `// Java - Hello World
// A simple starter template

public class Main {
    public static String greet(String name) {
        return "Hello, " + name + "! Welcome to Collaborative Platform.";
    }

    public static void main(String[] args) {
        String message = greet("World");
        System.out.println(message);
    }
}
`,

  cpp: `// C++ - Hello World
// A simple starter template

#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    return "Hello, " + name + "! Welcome to Collaborative Platform.";
}

int main() {
    std::string message = greet("World");
    std::cout << message << std::endl;
    return 0;
}
`,

  go: `// Go - Hello World
// A simple starter template

package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s! Welcome to Collaborative Platform.", name)
}

func main() {
    message := greet("World")
    fmt.Println(message)
}
`,

  rust: `// Rust - Hello World
// A simple starter template

fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Collaborative Platform.", name)
}

fn main() {
    let message = greet("World");
    println!("{}", message);
}
`,

  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Collaborative Platform - Hello World</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #0f0f23, #1a1a3e);
            color: #e0e0ff;
        }
        h1 {
            font-size: 2.5rem;
            background: linear-gradient(90deg, #00d4ff, #00ff88);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    </style>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>
`,
}

/**
 * Returns the boilerplate code for the given language value.
 * Falls back to a generic comment if the language is not found.
 */
export function getBoilerplate(languageValue) {
  return BOILERPLATES[languageValue] || `// Start coding in ${languageValue}!\n`
}

export default BOILERPLATES
