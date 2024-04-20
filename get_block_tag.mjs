const one_day = 24 * 60 * 60

const get_tag_from_block_account = ({
  block_account,
  local_timestamp,
  subtype,
  link_as_account
}) => {
  switch (block_account) {
    case 'nano_1gjku9ph9dtcfhs3x4xi9exxktdof14e8rwbk4qkztemjqbpfb6xheqknbp8': {
      if (local_timestamp < 1598389857 + one_day) {
        return ['kind/spam']
      }

      return null
    }

    case 'nano_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k':
      // is a withdrawal if it is a send to a non binace account
      // TODO check against an array of constants listing binance accounts
      if (
        subtype === 'send' &&
        link_as_account !==
          'nano_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k'
      ) {
        return ['kind/withdrawal']
      }

    default:
      return null
  }
}

export const get_block_tags = ({ block_info }) => {
  const tags = []

  const account_tags = get_tag_from_block_account(block_info)
  if (account_tags) {
    tags.push(...account_tags)
  }
}
