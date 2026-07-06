const fs = require('fs')

const data = JSON.parse(fs.readFileSync('categories.json', 'utf8'))

function findCategoryNode(node, id) {
  if (node.category.categoryId === id) return node
  if (node.childCategoryTreeNodes) {
    for (const child of node.childCategoryTreeNodes) {
      const found = findCategoryNode(child, id)
      if (found) return found
    }
  }
  return null
}

const carPartsRoot = findCategoryNode(data.rootCategoryNode, '6030') // Car & Truck Parts

const leaves = []

function collectLeaves(node, path) {
  const currentPath = path ? `${path} > ${node.category.categoryName}` : node.category.categoryName
  if (!node.childCategoryTreeNodes || node.childCategoryTreeNodes.length === 0) {
    leaves.push({ id: node.category.categoryId, name: currentPath })
  } else {
    for (const child of node.childCategoryTreeNodes) {
      collectLeaves(child, currentPath)
    }
  }
}

collectLeaves(carPartsRoot, '')

fs.writeFileSync('leaves.json', JSON.stringify(leaves, null, 2))
console.log(`Found ${leaves.length} leaf categories under Car & Truck Parts.`)
