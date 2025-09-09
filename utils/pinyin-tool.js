import {pinyin} from 'pinyin';

export function getFirstLetter(text) {
    const pinyinArray = pinyin(text, {
        style: pinyin.STYLE_FIRST_LETTER,
    });
    return pinyinArray.map(item => item[0].toUpperCase()).join('');
}
