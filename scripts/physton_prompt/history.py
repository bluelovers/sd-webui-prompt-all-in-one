from scripts.physton_prompt.storage import Storage
import uuid
import time


class History:
    histories = {
        'txt2img': [],
        'txt2img_neg': [],
        'img2img': [],
        'img2img_neg': [],
    }
    favorites = {
        'txt2img': [],
        'txt2img_neg': [],
        'img2img': [],
        'img2img_neg': [],
    }
    # prompt 面板（tag 星號、拖曳）產生的收藏，與歷史紀錄的收藏分開儲存
    tag_favorites = {
        'txt2img': [],
        'txt2img_neg': [],
        'img2img': [],
        'img2img_neg': [],
    }
    max = 100

    def __init__(self):
        for type in self.histories:
            self.histories[type] = Storage.get('history.' + type)
            if self.histories[type] is None:
                self.histories[type] = []
                self.__save_histories(type)

        for type in self.favorites:
            self.favorites[type] = Storage.get('favorite.' + type)
            if self.favorites[type] is None:
                self.favorites[type] = []
                self.__save_favorites(type)

        for type in self.tag_favorites:
            self.tag_favorites[type] = Storage.get('favorite_tag.' + type)
            if self.tag_favorites[type] is None:
                self.tag_favorites[type] = []
                self.__save_tag_favorites(type)

    def __save_histories(self, type):
        Storage.set('history.' + type, self.histories[type])

    def __save_favorites(self, type):
        Storage.set('favorite.' + type, self.favorites[type])

    def __save_tag_favorites(self, type):
        Storage.set('favorite_tag.' + type, self.tag_favorites[type])

    def __favorite_store(self, kind):
        stores = {
            'history': (self.favorites, self.__save_favorites),
            'tag': (self.tag_favorites, self.__save_tag_favorites),
        }
        return stores[kind]

    def __new_item(self, tags, prompt, name):
        return {
            'id': str(uuid.uuid1()),
            'time': int(time.time()),
            'name': name,
            'tags': tags,
            'prompt': prompt,
        }

    def get_histories(self, type):
        histories = self.histories[type]
        for history in histories:
            history['is_favorite'] = self.is_favorite(type, history['id'])
        return histories

    def is_favorite(self, type, id):
        for favorite in self.favorites[type]:
            if favorite['id'] == id:
                return True
        return False

    def get_favorites(self, type, kind):
        return self.__favorite_store(kind)[0][type]

    def push_history(self, type, tags, prompt, name=''):
        if len(self.histories[type]) >= self.max:
            self.histories[type].pop(0)
        item = self.__new_item(tags, prompt, name)
        self.histories[type].append(item)
        self.__save_histories(type)
        return item

    def push_favorite(self, type, tags, prompt, name, kind):
        store, save = self.__favorite_store(kind)
        item = self.__new_item(tags, prompt, name)
        store[type].append(item)
        save(type)
        return item

    def move_favorite(self, type, id, offset, kind):
        store, save = self.__favorite_store(kind)
        for index, favorite in enumerate(store[type]):
            if favorite['id'] != id:
                continue
            target = index + offset
            if target < 0 or target >= len(store[type]):
                return False
            store[type].insert(target, store[type].pop(index))
            save(type)
            return True
        return False

    def get_latest_history(self, type):
        if len(self.histories[type]) > 0:
            return self.histories[type][-1]
        return None

    def set_history(self, type, id, tags, prompt, name):
        for history in self.histories[type]:
            if history['id'] == id:
                history['tags'] = tags
                history['prompt'] = prompt
                history['name'] = name
                self.__save_histories(type)
                if self.is_favorite(type, id):
                    self.set_favorite(type, id, tags, prompt, name)
                return True
        return False

    def set_favorite(self, type, id, tags, prompt, name):
        for favorite in self.favorites[type]:
            if favorite['id'] == id:
                favorite['tags'] = tags
                favorite['prompt'] = prompt
                favorite['name'] = name
                self.__save_favorites(type)
                return True
        return False

    def set_history_name(self, type, id, name):
        for history in self.histories[type]:
            if history['id'] == id:
                history['name'] = name
                self.__save_histories(type)
                for favorite in self.favorites[type]:
                    if favorite['id'] == id:
                        favorite['name'] = name
                        self.__save_favorites(type)
                return True
        return False

    def set_favorite_name(self, type, id, name, kind):
        store, save = self.__favorite_store(kind)
        for favorite in store[type]:
            if favorite['id'] == id:
                favorite['name'] = name
                save(type)
                if kind == 'history':
                    for history in self.histories[type]:
                        if history['id'] == id:
                            history['name'] = name
                            self.__save_histories(type)
                return True
        return False

    def dofavorite(self, type, id):
        if self.is_favorite(type, id):
            return False
        for history in self.histories[type]:
            if history['id'] == id:
                self.favorites[type].append(history)
                self.__save_favorites(type)
                return True
        return False

    def unfavorite(self, type, id, kind):
        store, save = self.__favorite_store(kind)
        for favorite in store[type]:
            if favorite['id'] == id:
                store[type].remove(favorite)
                save(type)
                return True
        return False

    def remove_history(self, type, id):
        for history in self.histories[type]:
            if history['id'] == id:
                self.histories[type].remove(history)
                self.__save_histories(type)
                return True
        return False

    def remove_histories(self, type):
        self.histories[type] = []
        self.__save_histories(type)
        return True
