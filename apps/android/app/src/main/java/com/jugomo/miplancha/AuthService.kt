package com.jugomo.miplancha

import com.google.firebase.auth.AuthResult
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

class AuthService() {
    private var _mutableUser : MutableStateFlow<Usuario?>
    private var _mutableIsRestoring : MutableStateFlow<Boolean>

    lateinit var mutableUser: StateFlow<Usuario?>
    lateinit var mutableIsRestoring : StateFlow<Boolean>

    init {
        _mutableUser = MutableStateFlow(null)
        _mutableIsRestoring = MutableStateFlow(true)

        mutableUser = _mutableUser.asStateFlow()
        mutableIsRestoring =_mutableIsRestoring.asStateFlow()
    }

    suspend fun startSession(companyId: String, username: String, password: String) {
        val syntheticEmail = UsernameEmail.syntheticEmail(companyId, username)
        val res: AuthResult

        try {
            res = FirebaseAuth.getInstance()
                .signInWithEmailAndPassword(syntheticEmail, password).await()

            val uid = res.user?.uid
            if (uid != null) {
                _mutableUser.value = getUser(uid)
            }
        } catch (e: Exception) {
            throw AuthError()
        }
    }

    suspend fun restoreSessionIfActiveUser() {
        _mutableIsRestoring.value = false

        val currUser =  FirebaseAuth.getInstance().currentUser
        if(currUser != null) {
            try {
                _mutableUser.value  = getUser(currUser.uid)
            } catch (e: Exception) {
                throw AuthError()
            }
        }
    }

     fun closeSession() {
        FirebaseAuth.getInstance().signOut()
        _mutableUser.value = null
    }

    private suspend fun getUser(uid: String): Usuario {
        val userSnapshot = FirebaseFirestore.getInstance()
            .collection("usuarios")
            .document(uid).get().await();

        val user = userSnapshot.toUsuario(
            uid = uid
        )

        return user
    }
}

class AuthError() : Exception("Auth Exception") {
}