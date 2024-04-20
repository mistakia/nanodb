const get_tag_from_block_account = ({ block_account, local_timestamp }) => {
  switch (block_account) {
    case 'nano_1gjku9ph9dtcfhs3x4xi9exxktdof14e8rwbk4qkztemjqbpfb6xheqknbp8':
      return ['kind/spam']

    // binance
    case 'nano_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k':
      return ['kind/exchange', 'kind/withdrawal']

    // tipnano
    // nano_1dragoncc4e1gt1eesn39waofnsc6boxjrnzt1x8hosr7snpjqy7xyyrpzfd

    default:
      return null
  }
}

export const get_account_tag = ({ open_block_info, block_info }) => {
  const tags = []
  const account_tags = get_tag_from_block_account(block_info)
  if (account_tags) {
    tags.push(...account_tags)
  }
  return tags
}
