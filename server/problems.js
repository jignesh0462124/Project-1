const DSA_PROBLEMS = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    category: "Array",
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    boilerplate: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Your code here

}

// Test your solution
console.log(twoSum([2,7,11,15], 9)); // Expected: [0,1]
console.log(twoSum([3,2,4], 6));     // Expected: [1,2]
`,
      python: `def two_sum(nums, target):
    # Your code here
    pass

# Test your solution
print(two_sum([2,7,11,15], 9))  # Expected: [0,1]
print(two_sum([3,2,4], 6))       # Expected: [1,2]
`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your code here
        return new int[]{};
    }
}
`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Your code here
        return {};
    }
};
`
    }
  },
  {
    id: 2,
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stack",
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: 's = "()"',
        output: "true",
        explanation: null
      },
      {
        input: 's = "()[]{}"',
        output: "true",
        explanation: null
      },
      {
        input: 's = "(]"',
        output: "false",
        explanation: null
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'."
    ],
    boilerplate: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Your code here

}

// Test your solution
console.log(isValid("()"));      // Expected: true
console.log(isValid("()[]{}"));  // Expected: true
console.log(isValid("(]"));     // Expected: false
`,
      python: `def is_valid(s):
    # Your code here
    pass

# Test your solution
print(is_valid("()"))      # Expected: True
print(is_valid("()[]{}")) # Expected: True
print(is_valid("(]"))     # Expected: False
`,
      java: `class Solution {
    public boolean isValid(String s) {
        // Your code here
        return false;
    }
}
`,
      cpp: `class Solution {
public:
    bool isValid(string s) {
        // Your code here
        return false;
    }
};
`
    }
  },
  {
    id: 3,
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    category: "Linked List",
    description: `You are given the heads of two sorted linked lists list1 and list2.

Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.`,
    examples: [
      {
        input: "list1 = [1,2,4], list2 = [1,3,4]",
        output: "[1,1,2,3,4,4]",
        explanation: null
      },
      {
        input: "list1 = [], list2 = []",
        output: "[]",
        explanation: null
      }
    ],
    constraints: [
      "The number of nodes in both lists is in the range [0, 50].",
      "-100 <= Node.val <= 100",
      "Both list1 and list2 are sorted in non-decreasing order."
    ],
    boilerplate: {
      javascript: `// Definition for singly-linked list
function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}

/**
 * @param {ListNode} list1
 * @param {ListNode} list2
 * @return {ListNode}
 */
function mergeTwoLists(list1, list2) {
    // Your code here

}

// Helper function to create linked list from array
function arrayToList(arr) {
    if (!arr.length) return null;
    const head = new ListNode(arr[0]);
    let curr = head;
    for (let i = 1; i < arr.length; i++) {
        curr.next = new ListNode(arr[i]);
        curr = curr.next;
    }
    return head;
}

// Helper function to print linked list
function printList(head) {
    const result = [];
    while (head) {
        result.push(head.val);
        head = head.next;
    }
    return result;
}

// Test your solution
console.log(printList(mergeTwoLists(arrayToList([1,2,4]), arrayToList([1,3,4]))));
// Expected: [1,1,2,3,4,4]
`,
      python: `# Definition for singly-linked list
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def merge_two_lists(list1, list2):
    # Your code here
    pass

# Helper function to print linked list
def print_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    return result

# Test your solution
l1 = ListNode(1, ListNode(2, ListNode(4)))
l2 = ListNode(1, ListNode(3, ListNode(4)))
print(print_list(merge_two_lists(l1, l2)))
# Expected: [1, 1, 2, 3, 4, 4]
`,
      java: `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        // Your code here
        return null;
    }
}
`,
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        // Your code here
        return nullptr;
    }
};
`
    }
  },
  {
    id: 4,
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Dynamic Programming",
    description: `Given an integer array nums, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous non-empty sequence of elements within an array.`,
    examples: [
      {
        input: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
        output: "6",
        explanation: "The subarray [4,-1,2,1] has the largest sum 6."
      },
      {
        input: "nums = [1]",
        output: "1",
        explanation: "The subarray [1] has the largest sum 1."
      },
      {
        input: "nums = [5,4,-1,7,8]",
        output: "23",
        explanation: "The subarray [5,4,-1,7,8] has the largest sum 23."
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^4 <= nums[i] <= 10^4"
    ],
    boilerplate: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function maxSubArray(nums) {
    // Your code here (Hint: Kadane's Algorithm)

}

// Test your solution
console.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4])); // Expected: 6
console.log(maxSubArray([1]));                    // Expected: 1
console.log(maxSubArray([5,4,-1,7,8]));          // Expected: 23
`,
      python: `def max_sub_array(nums):
    # Your code here (Hint: Kadane's Algorithm)
    pass

# Test your solution
print(max_sub_array([-2,1,-3,4,-1,2,1,-5,4]))  # Expected: 6
print(max_sub_array([1]))                       # Expected: 1
print(max_sub_array([5,4,-1,7,8]))              # Expected: 23
`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Your code here (Hint: Kadane's Algorithm)
        return 0;
    }
}
`,
      cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Your code here (Hint: Kadane's Algorithm)
        return 0;
    }
};
`
    }
  },
  {
    id: 5,
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    category: "Binary Tree",
    description: `Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).

Return the result as a list of lists of integers.`,
    examples: [
      {
        input: "root = [3,9,20,null,null,15,7]",
        output: "[[3],[9,20],[15,7]]",
        explanation: null
      },
      {
        input: "root = [1]",
        output: "[[1]]",
        explanation: null
      },
      {
        input: "root = []",
        output: "[]",
        explanation: null
      }
    ],
    constraints: [
      "The number of nodes in the tree is in the range [0, 2000].",
      "-1000 <= Node.val <= 1000"
    ],
    boilerplate: {
      javascript: `// Definition for binary tree node
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

/**
 * @param {TreeNode} root
 * @return {number[][]}
 */
function levelOrder(root) {
    // Your code here

}

// Test your solution
// [3,9,20,null,null,15,7] -> [[3],[9,20],[15,7]]
const root1 = new TreeNode(3);
root1.left = new TreeNode(9);
root1.right = new TreeNode(20);
root1.right.left = new TreeNode(15);
root1.right.right = new TreeNode(7);
console.log(levelOrder(root1)); // Expected: [[3],[9,20],[15,7]]

console.log(levelOrder(null));  // Expected: []
`,
      python: `from collections import deque

# Definition for binary tree node
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def level_order(root):
    # Your code here
    pass

# Test your solution
# [3,9,20,null,null,15,7] -> [[3],[9,20],[15,7]]
root = TreeNode(3)
root.left = TreeNode(9)
root.right = TreeNode(20)
root.right.left = TreeNode(15)
root.right.right = TreeNode(7)
print(level_order(root))  # Expected: [[3], [9, 20], [15, 7]]
`,
      java: `/**
 * Definition for binary tree node.
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) {
 *         this.val = val;
 *         this.left = left;
 *         this.right = right;
 *     }
 * }
 */
class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        // Your code here
        return new ArrayList<>();
    }
}
`,
      cpp: `/**
 * Definition for binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        // Your code here
        return {};
    }
};
`
    }
  }
];

module.exports = { DSA_PROBLEMS };
